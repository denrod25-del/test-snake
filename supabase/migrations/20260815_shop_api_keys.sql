-- ============================================================================
-- Shop API keys for Service Property Intelligence (SPI)
-- Apply in Supabase SQL Editor before issuing keys or advertising /api/property.
-- Service-role only: RLS enabled with no policies for anon/authenticated.
-- ============================================================================

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

-- Intentionally no policies for anon/authenticated — Netlify service role only.
comment on table public.shop_api_keys is
  'SPI shop API keys (hashed). Readable/writable only via service_role; never query from the browser.';
