-- Field Service Ops core schema (dedicated Supabase project)
-- Apply via SQL Editor or CLI. Do not merge into DeedScout schema.

create extension if not exists "pgcrypto";

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  stripe_connect_account_id text,
  created_at timestamptz not null default now()
);

-- SPI secrets: service-role only (no authenticated/anon policies)
create table public.shop_spi_secrets (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  is_owner boolean not null default false,
  is_csr boolean not null default false,
  is_dispatcher boolean not null default false,
  is_tech boolean not null default false,
  unique (shop_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  status text not null check (status in ('pending','confirmed','declined')),
  trade text not null check (trade in ('plumbing','hvac','electrical')),
  description text not null,
  contact_name text not null,
  contact_phone text not null,
  address text not null,
  preferred_window text not null default '',
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id),
  trade text not null check (trade in ('plumbing','hvac','electrical')),
  description text not null,
  address text not null,
  preferred_window text not null default '',
  status text not null check (status in ('unassigned','scheduled','en_route','on_site','done')),
  payment_status text not null check (payment_status in ('unpaid','partial','processing','paid')),
  tech_user_id uuid references auth.users(id),
  scheduled_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.pricebook_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  trade text not null check (trade in ('plumbing','hvac','electrical')),
  unit_amount_cents int not null check (unit_amount_cents >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_amount_cents int not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  amount_cents int not null,
  status text not null check (status in ('pending','processing','succeeded','failed')),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create or replace function public.is_shop_member(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop and m.user_id = auth.uid()
  );
$$;

create or replace function public.create_shop_with_owner(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.shops (name, slug)
  values (p_name, lower(regexp_replace(p_slug, '[^a-z0-9-]', '-', 'g')))
  returning id into v_shop;
  insert into public.shop_members (shop_id, user_id, email, is_owner, is_csr, is_dispatcher, is_tech)
  values (v_shop, auth.uid(), coalesce(auth.jwt()->>'email', ''), true, true, true, true);
  return v_shop;
end;
$$;

create or replace function public.submit_public_request(
  p_slug text,
  p_trade text,
  p_description text,
  p_contact_name text,
  p_contact_phone text,
  p_address text,
  p_preferred_window text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop uuid;
  v_id uuid;
begin
  select id into v_shop from public.shops where slug = p_slug;
  if v_shop is null then
    raise exception 'shop not found';
  end if;
  insert into public.service_requests (
    shop_id, status, trade, description, contact_name, contact_phone, address, preferred_window
  ) values (
    v_shop, 'pending', p_trade, left(p_description, 2000), left(p_contact_name, 200),
    left(p_contact_phone, 40), left(p_address, 400), left(p_preferred_window, 200)
  ) returning id into v_id;
  return v_id;
end;
$$;

alter table public.shops enable row level security;
alter table public.shop_spi_secrets enable row level security;
alter table public.shop_members enable row level security;
alter table public.customers enable row level security;
alter table public.service_requests enable row level security;
alter table public.jobs enable row level security;
alter table public.pricebook_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;

-- No policies on shop_spi_secrets => only service role

create policy shops_member_select on public.shops for select using (public.is_shop_member(id));
create policy members_select on public.shop_members for select using (public.is_shop_member(shop_id));
create policy customers_all on public.customers for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy requests_member on public.service_requests for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy jobs_all on public.jobs for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy pricebook_all on public.pricebook_items for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy invoices_all on public.invoices for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy payments_all on public.payments for all using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));

create policy invoice_lines_via_invoice on public.invoice_lines for all using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_shop_member(i.shop_id)
  )
) with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.is_shop_member(i.shop_id)
  )
);

-- Public may resolve shop slug for request page (id/name/slug only)
create policy shops_public_slug on public.shops for select to anon using (true);

revoke all on public.shop_spi_secrets from anon, authenticated;
