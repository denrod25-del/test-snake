-- ============================================================================
-- Grant AVM + skip-trace credits to every active/trialing Pro profile.
-- Run in Supabase → SQL Editor if Netlify cannot provision data_credits.
-- Safe to re-run. Does NOT create tables — run 20260419_data_credits_and_caches.sql
-- first if the data_credits table does not exist yet.
-- ============================================================================

-- 1) Top up / create buckets for all active Pro users
insert into public.data_credits (user_id, credit_type, balance, monthly_grant, last_refilled, updated_at)
select
  p.id,
  x.credit_type,
  x.grant_amt,
  x.grant_amt,
  now(),
  now()
from public.profiles p
cross join (
  values
    ('skip_trace'::text, 50),
    ('avm'::text, 200)
) as x(credit_type, grant_amt)
where p.subscription_plan = 'pro'
  and p.subscription_status in ('active', 'trialing')
on conflict (user_id, credit_type) do update
set
  balance = case
    when public.data_credits.balance = 0
         and coalesce(public.data_credits.monthly_grant, 0) = 0
      then excluded.balance
    when public.data_credits.balance = 0
         and public.data_credits.last_refilled is null
      then excluded.balance
    else public.data_credits.balance
  end,
  monthly_grant = excluded.monthly_grant,
  last_refilled = coalesce(public.data_credits.last_refilled, excluded.last_refilled),
  updated_at = now();

-- 2) Sanity check — should show your Pro user with balance 50 / 200
select
  p.email,
  p.subscription_plan,
  p.subscription_status,
  c.credit_type,
  c.balance,
  c.monthly_grant,
  c.last_refilled
from public.profiles p
left join public.data_credits c on c.user_id = p.id
where p.subscription_plan = 'pro'
order by p.email, c.credit_type;
