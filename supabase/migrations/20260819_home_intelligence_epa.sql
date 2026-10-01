-- Home Intelligence V1 — EPA ingestion helpers
-- SDWA is a quarterly snapshot. UCMR 5 is occurrence monitoring and MUST NOT
-- be treated as proof of a regulatory violation.

create table if not exists public.hi_pws_snapshots (
  pws_id text not null,
  source_snapshot text not null,
  pws_name text,
  activity_status text,
  system_type text,
  population_served integer,
  primary_source text,
  owner_type text,
  primacy_agency text,
  source_key text not null default 'epa_sdwa',
  raw_source_record_id text,
  ingested_at timestamptz not null default now(),
  primary key (pws_id, source_snapshot)
);

alter table public.hi_pws_snapshots enable row level security;
create index if not exists hi_pws_snapshots_snapshot_idx
  on public.hi_pws_snapshots(source_snapshot, pws_id);

create or replace function public.hi_ingest_sdwa_pws_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>'pws_id','') = '' or coalesce(r->>'source_snapshot','') = '' then
      continue;
    end if;

    insert into public.hi_pws_snapshots(
      pws_id, source_snapshot, pws_name, activity_status, system_type,
      population_served, primary_source, owner_type, primacy_agency,
      raw_source_record_id
    ) values (
      r->>'pws_id', r->>'source_snapshot', r->>'pws_name',
      r->>'activity_status', r->>'system_type',
      nullif(r->>'population_served','')::integer,
      r->>'primary_source', r->>'owner_type', r->>'primacy_agency',
      r->>'source_record_id'
    )
    on conflict (pws_id, source_snapshot) do update set
      pws_name = excluded.pws_name,
      activity_status = excluded.activity_status,
      system_type = excluded.system_type,
      population_served = excluded.population_served,
      primary_source = excluded.primary_source,
      owner_type = excluded.owner_type,
      primacy_agency = excluded.primacy_agency,
      raw_source_record_id = excluded.raw_source_record_id,
      ingested_at = now();

    -- Canonical PWS record always reflects the newest ingested snapshot.
    insert into public.hi_public_water_systems(
      pws_id, name, activity_status, system_type, population_served,
      primary_source, owner_type, primacy_agency, source_snapshot,
      source_updated_at, updated_at
    ) values (
      r->>'pws_id', r->>'pws_name', r->>'activity_status', r->>'system_type',
      nullif(r->>'population_served','')::integer,
      r->>'primary_source', r->>'owner_type', r->>'primacy_agency',
      r->>'source_snapshot', now(), now()
    )
    on conflict (pws_id) do update set
      name = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.name else hi_public_water_systems.name end,
      activity_status = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.activity_status else hi_public_water_systems.activity_status end,
      system_type = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.system_type else hi_public_water_systems.system_type end,
      population_served = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.population_served else hi_public_water_systems.population_served end,
      primary_source = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.primary_source else hi_public_water_systems.primary_source end,
      owner_type = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.owner_type else hi_public_water_systems.owner_type end,
      primacy_agency = case when excluded.source_snapshot >= coalesce(hi_public_water_systems.source_snapshot,'') then excluded.primacy_agency else hi_public_water_systems.primacy_agency end,
      source_snapshot = greatest(coalesce(hi_public_water_systems.source_snapshot,''), excluded.source_snapshot),
      source_updated_at = now(),
      updated_at = now();

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.hi_ingest_sdwa_violation_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>'pws_id','') = '' or coalesce(r->>'violation_id','') = '' or coalesce(r->>'source_snapshot','') = '' then
      continue;
    end if;
    insert into public.hi_water_violations(
      pws_id, violation_id, violation_code, contaminant_code,
      begin_date, end_date, resolved, source_snapshot, source_key
    ) values (
      r->>'pws_id', r->>'violation_id', r->>'violation_code', r->>'contaminant_code',
      nullif(r->>'begin_date','')::date, nullif(r->>'end_date','')::date,
      coalesce((r->>'resolved')::boolean, false), r->>'source_snapshot', 'epa_sdwa'
    )
    on conflict (source_key, pws_id, violation_id, source_snapshot) do update set
      violation_code = excluded.violation_code,
      contaminant_code = excluded.contaminant_code,
      begin_date = excluded.begin_date,
      end_date = excluded.end_date,
      resolved = excluded.resolved;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.hi_ingest_ucmr5_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>'pws_id','') = '' or coalesce(r->>'contaminant_name','') = '' then
      continue;
    end if;
    insert into public.hi_water_results(
      pws_id, sample_location_id, contaminant_code, contaminant_name,
      sample_date, result_value, result_operator, unit, detection_limit,
      result_type, source_key, source_record_id
    ) values (
      r->>'pws_id', r->>'sample_location_id', r->>'contaminant_code', r->>'contaminant_name',
      nullif(r->>'sample_date','')::date,
      nullif(r->>'result_value','')::numeric,
      r->>'result_operator', r->>'unit', nullif(r->>'detection_limit','')::numeric,
      'ucmr_occurrence', 'epa_ucmr5', r->>'source_record_id'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Utility-to-PWS mapping is curated/verified rather than guessed from ZIP/city.
create table if not exists public.hi_utility_pws_links (
  utility_id uuid not null references public.hi_utilities(id) on delete cascade,
  pws_id text not null references public.hi_public_water_systems(pws_id) on delete cascade,
  relationship text not null default 'serves',
  confidence numeric(4,3) not null default 1.000 check (confidence between 0 and 1),
  verification_method text not null,
  source_key text,
  verified_at timestamptz not null default now(),
  primary key (utility_id, pws_id)
);

alter table public.hi_utility_pws_links enable row level security;
create index if not exists hi_utility_pws_links_pws_idx on public.hi_utility_pws_links(pws_id);
