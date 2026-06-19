-- =====================================================================
-- B. Symbolic Code Platform — Plomería Hub integration
-- Migration: code_user_notes
-- Created: 2026-06-19
-- =====================================================================
-- Stores per-user personal notes against FBC-P code sections so notes
-- persist across devices for logged-in Plomería Hub users (vs. the
-- anonymous localStorage-only experience on code.bsymbolic.com).
--
-- One row per (user, section). Updating an existing note is an upsert.
-- =====================================================================

create table if not exists public.code_user_notes (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  section_id      text          not null,
  content         text          not null default '',
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),

  -- One note per user per section. Editing replaces; deleting removes the row.
  unique (user_id, section_id),

  -- Defensive: section_id is the FBC-P section number (e.g. "909.1") —
  -- bound to short identifiers so a typo or injection can't store
  -- megabytes per user. Adjust if the dataset ever uses longer keys.
  constraint code_user_notes_section_id_length check (char_length(section_id) between 1 and 32),

  -- Cap note length at 16 KB. Realistic notes are 1–3 sentences;
  -- anything longer is almost certainly accidental paste.
  constraint code_user_notes_content_length   check (char_length(content) <= 16384)
);

-- Lookup by user is the common access pattern (list all notes for a user
-- on their dashboard, batch-load for a session)
create index if not exists code_user_notes_user_id_idx
  on public.code_user_notes (user_id);

-- =====================================================================
-- Row-Level Security
-- Every read and write checked against auth.uid() so a user can only
-- touch their own rows. Required because this table is queried from
-- the browser via the Supabase anon key.
-- =====================================================================

alter table public.code_user_notes enable row level security;

create policy "code_user_notes: owner read"
  on public.code_user_notes
  for select
  using (auth.uid() = user_id);

create policy "code_user_notes: owner insert"
  on public.code_user_notes
  for insert
  with check (auth.uid() = user_id);

create policy "code_user_notes: owner update"
  on public.code_user_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "code_user_notes: owner delete"
  on public.code_user_notes
  for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- updated_at maintenance
-- =====================================================================

create or replace function public.handle_code_user_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists code_user_notes_set_updated_at on public.code_user_notes;

create trigger code_user_notes_set_updated_at
  before update on public.code_user_notes
  for each row
  execute function public.handle_code_user_notes_updated_at();

-- =====================================================================
-- Bookmarks — same shape, simpler payload
-- =====================================================================

create table if not exists public.code_user_bookmarks (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  section_id      text          not null,
  created_at      timestamptz   not null default now(),

  unique (user_id, section_id),
  constraint code_user_bookmarks_section_id_length check (char_length(section_id) between 1 and 32)
);

create index if not exists code_user_bookmarks_user_id_idx
  on public.code_user_bookmarks (user_id);

alter table public.code_user_bookmarks enable row level security;

create policy "code_user_bookmarks: owner read"
  on public.code_user_bookmarks
  for select
  using (auth.uid() = user_id);

create policy "code_user_bookmarks: owner insert"
  on public.code_user_bookmarks
  for insert
  with check (auth.uid() = user_id);

create policy "code_user_bookmarks: owner delete"
  on public.code_user_bookmarks
  for delete
  using (auth.uid() = user_id);
