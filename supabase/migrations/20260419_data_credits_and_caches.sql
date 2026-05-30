-- ============================================================================
-- 20260419_data_credits_and_caches.sql
-- ----------------------------------------------------------------------------
-- Adds the credit ledger + result caches that back two new Pro features:
--
--   1. Skip-tracing  (BatchData API → owner phones / emails / alt addresses)
--   2. AVM lookups   (RentCast API → estimated value + comparable sales)
--
-- Both vendors charge per-call, so:
--   * server-side authoritative balance is enforced before every paid call
--   * results are cached so the same parcel never gets billed twice
--   * the Stripe webhook refills credits on each successful invoice
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- data_credits  (per-user, per-credit-type running balance)
-- ----------------------------------------------------------------------------
create table if not exists public.data_credits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  credit_type     text not null check (credit_type in ('skip_trace', 'avm')),
  balance         integer not null default 0,
  monthly_grant   integer not null default 0,    -- how many to refill on each invoice
  last_refilled   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, credit_type)
);

create index if not exists data_credits_user_idx on public.data_credits(user_id);

alter table public.data_credits enable row level security;

drop policy if exists "Users can read own credits" on public.data_credits;
create policy "Users can read own credits"
  on public.data_credits for select
  using (auth.uid() = user_id);

-- All writes happen through the service-role key in the Netlify function
-- (deduction + refill). Users cannot mutate their own balance directly.

-- ----------------------------------------------------------------------------
-- skip_trace_cache  (one row per (county, parcel_id))
-- ----------------------------------------------------------------------------
-- We cache by parcel rather than by user so credits don't get re-burned when
-- another user looks at the same parcel. The first user to look it up pays;
-- everyone else (with a Pro plan) reads from cache for free for `cache_ttl_days`.
-- After TTL the cache row is considered stale and a fresh BatchData call is
-- made (still costing a credit) on next request.
create table if not exists public.skip_trace_cache (
  id              uuid primary key default gen_random_uuid(),
  county_slug     text not null,
  parcel_id       text not null,
  -- Owner name + address used in the lookup; helps detect when a parcel sells
  -- and the cached result is no longer relevant.
  owner_name      text,
  address         text,
  -- Vendor response, lightly normalized. Full vendor payload also stored for
  -- debugging and to allow extracting more fields later without re-spending.
  result          jsonb not null,
  raw_vendor      jsonb,
  vendor          text not null default 'batchdata',
  fetched_at      timestamptz not null default now(),
  fetched_by      uuid references auth.users(id) on delete set null,
  unique (county_slug, parcel_id)
);

create index if not exists skip_trace_cache_lookup_idx
  on public.skip_trace_cache(county_slug, parcel_id);

alter table public.skip_trace_cache enable row level security;

-- All Pro users can read; only the function (service role) can insert/update.
drop policy if exists "Pro users can read skip-trace cache" on public.skip_trace_cache;
create policy "Pro users can read skip-trace cache"
  on public.skip_trace_cache for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.subscription_plan = 'pro'
        and profiles.subscription_status in ('active', 'trialing')
    )
  );

-- ----------------------------------------------------------------------------
-- avm_cache (estimated value + comparables, cached per parcel address)
-- ----------------------------------------------------------------------------
create table if not exists public.avm_cache (
  id              uuid primary key default gen_random_uuid(),
  -- Some counties don't have parcel IDs that resolve cleanly to addresses, so
  -- we key on (county_slug, parcel_id) when present and (address) as a
  -- fallback. The unique constraint is on (county_slug, parcel_id) because
  -- that's the strongest natural key.
  county_slug     text not null,
  parcel_id       text not null,
  address         text not null,
  estimated_value numeric(12,2),
  value_low       numeric(12,2),
  value_high      numeric(12,2),
  confidence      text,
  comparables     jsonb,
  raw_vendor      jsonb,
  vendor          text not null default 'rentcast',
  fetched_at      timestamptz not null default now(),
  fetched_by      uuid references auth.users(id) on delete set null,
  unique (county_slug, parcel_id)
);

create index if not exists avm_cache_lookup_idx
  on public.avm_cache(county_slug, parcel_id);

alter table public.avm_cache enable row level security;

drop policy if exists "Pro users can read avm cache" on public.avm_cache;
create policy "Pro users can read avm cache"
  on public.avm_cache for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.subscription_plan = 'pro'
        and profiles.subscription_status in ('active', 'trialing')
    )
  );

-- ----------------------------------------------------------------------------
-- credit_ledger  (audit trail of every grant + spend)
-- Helps debug "why did my balance drop?" and surfaces in the Account page.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  credit_type   text not null check (credit_type in ('skip_trace', 'avm')),
  delta         integer not null,        -- negative = spend, positive = grant
  reason        text not null,           -- 'monthly_refill' | 'spend' | 'manual_grant' | 'refund'
  context       jsonb,                   -- e.g. { parcel_id, vendor_request_id }
  balance_after integer not null,
  created_at    timestamptz default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists "Users can read own ledger" on public.credit_ledger;
create policy "Users can read own ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Helpful RPC: refill_monthly_credits(user_id)
-- Idempotent within ~28 days — won't double-grant if called twice in a month.
-- Called by the Stripe webhook on invoice.payment_succeeded.
-- ----------------------------------------------------------------------------
create or replace function public.refill_monthly_credits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id, credit_type, balance, monthly_grant, last_refilled
    from public.data_credits
    where user_id = p_user_id
  loop
    -- Skip if already refilled within the last 25 days (handles webhook retries)
    if rec.last_refilled is not null and rec.last_refilled > now() - interval '25 days' then
      continue;
    end if;
    -- Carry-over capped at 2 months' worth so users don't hoard credits forever
    update public.data_credits
       set balance       = least(rec.balance + rec.monthly_grant, rec.monthly_grant * 2),
           last_refilled = now(),
           updated_at    = now()
     where id = rec.id;
    insert into public.credit_ledger (user_id, credit_type, delta, reason, balance_after)
    values (p_user_id, rec.credit_type, rec.monthly_grant, 'monthly_refill',
            least(rec.balance + rec.monthly_grant, rec.monthly_grant * 2));
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Helpful RPC: ensure_credit_buckets(user_id, skip_grant, avm_grant)
-- Creates rows on first Pro upgrade so the user has buckets to refill into.
-- Called by the Stripe webhook on subscription create.
-- ----------------------------------------------------------------------------
create or replace function public.ensure_credit_buckets(
  p_user_id uuid,
  p_skip_grant integer default 50,
  p_avm_grant  integer default 200
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.data_credits (user_id, credit_type, balance, monthly_grant)
  values
    (p_user_id, 'skip_trace', p_skip_grant, p_skip_grant),
    (p_user_id, 'avm',        p_avm_grant,  p_avm_grant)
  on conflict (user_id, credit_type) do update
    set monthly_grant = excluded.monthly_grant;
end;
$$;

-- ----------------------------------------------------------------------------
-- Helpful RPC: spend_credit(user_id, credit_type, context_jsonb)
-- Atomic decrement with balance check. Returns true if spent, false if broke.
-- ----------------------------------------------------------------------------
create or replace function public.spend_credit(
  p_user_id     uuid,
  p_credit_type text,
  p_context     jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  update public.data_credits
     set balance    = balance - 1,
         updated_at = now()
   where user_id = p_user_id
     and credit_type = p_credit_type
     and balance > 0
   returning balance into v_balance;

  if v_balance is null then
    return false;
  end if;

  insert into public.credit_ledger (user_id, credit_type, delta, reason, context, balance_after)
  values (p_user_id, p_credit_type, -1, 'spend', p_context, v_balance);

  return true;
end;
$$;
