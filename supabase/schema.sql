-- ============================================================================
-- Florida Tax Deed Registry — Supabase schema
-- ----------------------------------------------------------------------------
-- Run this entire file in the Supabase SQL Editor for a fresh project.
-- It is idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text,
  full_name                text,
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,
  subscription_status      text default 'free',          -- free | trialing | active | past_due | canceled
  subscription_plan        text default 'free',          -- free | pro
  current_period_end       timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: when a new auth.users row is created, auto-create a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- watchlist_parcels (Pro: cloud-synced parcels, replaces localStorage)
-- ----------------------------------------------------------------------------
create table if not exists public.watchlist_parcels (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  county_slug  text not null,
  parcel_id    text,
  address      text,
  owner        text,
  assessed     text,
  opening_bid  text,
  max_bid      text,
  liens        text,
  notes        text,
  status       text default 'researching',    -- researching | ready | passed | won | lost
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists watchlist_user_idx on public.watchlist_parcels(user_id);
create index if not exists watchlist_county_idx on public.watchlist_parcels(user_id, county_slug);

alter table public.watchlist_parcels enable row level security;

drop policy if exists "Users manage own parcels" on public.watchlist_parcels;
create policy "Users manage own parcels"
  on public.watchlist_parcels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- alert_subscriptions (Pro: per-county email alert preferences)
-- Property Intelligence Beta intake currently uses Netlify Forms (signal-alerts)
-- + browser localStorage. Extend this table when automated signal email ships:
--   zoning / permits / tax_calendar / certs / flood booleans.
-- ----------------------------------------------------------------------------
create table if not exists public.alert_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  county      text not null,
  surplus     boolean default false,
  created_at  timestamptz default now(),
  unique (user_id, county)
);

alter table public.alert_subscriptions enable row level security;

drop policy if exists "Users manage own alerts" on public.alert_subscriptions;
create policy "Users manage own alerts"
  on public.alert_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- surplus_history (read-only data; populated by backend job)
-- Visible only to Pro subscribers via RLS check against profiles.subscription_plan
-- ----------------------------------------------------------------------------
create table if not exists public.surplus_history (
  id              uuid primary key default gen_random_uuid(),
  county          text not null,
  sale_date       date not null,
  parcel_id       text,
  property_addr   text,
  prior_owner     text,
  surplus_amount  numeric(12,2),
  status          text default 'unclaimed',  -- unclaimed | claim_filed | paid | escheated
  claim_deadline  date,
  source_url      text,
  created_at      timestamptz default now()
);

create index if not exists surplus_county_idx on public.surplus_history(county);
create index if not exists surplus_date_idx on public.surplus_history(sale_date desc);

-- Natural key for the scraper's upsert. NULLs in parcel_id are allowed and
-- treated as distinct values, so we coalesce with empty string at the index level.
create unique index if not exists surplus_natkey_idx
  on public.surplus_history (county, sale_date, coalesce(parcel_id, ''));

alter table public.surplus_history enable row level security;

drop policy if exists "Pro users can view surplus" on public.surplus_history;
create policy "Pro users can view surplus"
  on public.surplus_history for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.subscription_plan = 'pro'
        and profiles.subscription_status in ('active', 'trialing')
    )
  );

-- Optional: seed a few sample rows so the Pro view has something to show on day one
insert into public.surplus_history (county, sale_date, parcel_id, property_addr, prior_owner, surplus_amount, status, claim_deadline)
values
  ('Orange',       '2026-03-04', '23-22-30-1234-00-010', '1247 Magnolia Ave, Orlando, FL',         'Williams Family Trust',   18420.00, 'unclaimed',   '2026-07-02'),
  ('Miami-Dade',   '2026-03-12', '01-3128-009-0540',     '8851 NW 24th St, Miami, FL',             'Carmen Delgado Estate',   42180.00, 'claim_filed', '2026-07-10'),
  ('Hillsborough', '2026-02-25', 'A-12-29-19-5RE-000007', '4406 Florida Ave, Tampa, FL',           'Robert Hayes',             7960.00, 'paid',        '2026-06-25'),
  ('Broward',      '2026-03-18', '4942-21-14-3140',      '1130 NW 7th Ct, Pompano Beach, FL',       'Sunshine Holdings LLC',   29005.00, 'unclaimed',   '2026-07-16'),
  ('Palm Beach',   '2026-03-25', '00-43-44-26-01-018-0090', '432 Camden Pl, Lake Worth, FL',       'Estate of Marguerite Tan', 11240.00, 'unclaimed',   '2026-07-23'),
  ('Lee',          '2026-03-11', '07-44-24-P3-00128.0010', '2218 SW 4th Ln, Cape Coral, FL',       'James &amp; Patricia Holt',12880.00, 'paid',        '2026-07-09'),
  ('Duval',        '2026-03-05', '142608-0040',          '5510 Hubbard St, Jacksonville, FL',       'Maria Sanchez',            8740.00, 'unclaimed',   '2026-07-03'),
  ('Pinellas',     '2026-03-19', '08-30-15-12834-001-0010','3424 28th Ave N, St Petersburg, FL',  'Coastal Investments LLC',  15330.00, 'claim_filed', '2026-07-17')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- shop_api_keys (SPI — Service Property Intelligence)
-- Service-role only. Apply migration 20260815_shop_api_keys.sql on existing DBs.
-- ----------------------------------------------------------------------------
create table if not exists public.shop_api_keys (
  id           uuid primary key default gen_random_uuid(),
  shop_name    text not null,
  key_prefix   text not null,
  key_hash     text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists shop_api_keys_key_hash_uidx
  on public.shop_api_keys (key_hash);

create index if not exists shop_api_keys_prefix_idx
  on public.shop_api_keys (key_prefix);

alter table public.shop_api_keys enable row level security;

