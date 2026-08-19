-- Extend alert_subscriptions with per-signal watch booleans.
-- The original table only had county + surplus; the digest function
-- needs to know which signals each subscriber opted into.

alter table public.alert_subscriptions
  add column if not exists watch_zoning  boolean default true,
  add column if not exists watch_permits boolean default true,
  add column if not exists watch_tax     boolean default true,
  add column if not exists watch_certs   boolean default false,
  add column if not exists watch_flood   boolean default false,
  add column if not exists notes         text default '',
  add column if not exists updated_at    timestamptz default now();
