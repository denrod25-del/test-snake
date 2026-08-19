-- Home Intelligence V1 canonical data model
-- Shared backend for DeedScout, Florida WIYW, and future API consumers.
-- Safe to apply alongside the existing DeedScout schema.

create extension if not exists postgis;

create table if not exists public.hi_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  agency text not null,
  dataset text not null,
  source_url text,
  source_priority integer not null default 100,
  license_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hi_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  dataset_version text,
  source_url text,
  source_hash text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_read bigint not null default 0,
  records_inserted bigint not null default 0,
  records_updated bigint not null default 0,
  records_rejected bigint not null default 0,
  status text not null default 'running',
  error text
);

create index if not exists hi_ingestion_runs_source_idx
  on public.hi_ingestion_runs(source_key, started_at desc);

create table if not exists public.hi_raw_records (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  dataset text not null,
  source_record_id text not null,
  source_version text,
  retrieved_at timestamptz not null default now(),
  payload jsonb not null,
  content_hash text not null,
  unique(source_key, dataset, source_record_id, content_hash)
);

create index if not exists hi_raw_records_lookup_idx
  on public.hi_raw_records(source_key, dataset, source_record_id);

create table if not exists public.hi_properties (
  id uuid primary key default gen_random_uuid(),
  state char(2) not null default 'FL',
  county text not null default 'Palm Beach',
  parcel_id text,
  site_address text,
  site_address_normalized text,
  street_number text,
  street_name text,
  street_suffix text,
  unit text,
  city text,
  municipality text,
  postal_code text,
  property_use_code text,
  property_use_description text,
  actual_year_built smallint,
  effective_year_built smallint,
  living_area_sqft integer,
  land_area_sqft bigint,
  acres numeric(12,4),
  residential_units integer,
  building_count integer,
  assessed_value numeric(14,2),
  market_value numeric(14,2),
  taxable_value numeric(14,2),
  last_sale_date date,
  last_sale_price numeric(14,2),
  centroid geography(point,4326),
  geometry geometry(multipolygon,4326),
  source_key text,
  source_record_id text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(state, county, parcel_id)
);

create index if not exists hi_properties_parcel_idx on public.hi_properties(parcel_id);
create index if not exists hi_properties_address_idx on public.hi_properties(site_address_normalized);
create index if not exists hi_properties_centroid_gix on public.hi_properties using gist(centroid);
create index if not exists hi_properties_geometry_gix on public.hi_properties using gist(geometry);

create table if not exists public.hi_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text not null default 'Palm Beach',
  state char(2) not null default 'FL',
  jurisdiction_type text,
  municipality_code text,
  geometry geometry(multipolygon,4326),
  source_key text,
  source_record_id text,
  source_updated_at timestamptz,
  unique(state, county, name)
);

create index if not exists hi_jurisdictions_geometry_gix
  on public.hi_jurisdictions using gist(geometry);

create table if not exists public.hi_utilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  utility_type text not null default 'potable_water',
  phone text,
  epa_pws_id text,
  source_key text,
  source_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, utility_type)
);

create table if not exists public.hi_utility_service_areas (
  id uuid primary key default gen_random_uuid(),
  utility_id uuid not null references public.hi_utilities(id) on delete cascade,
  geometry geometry(multipolygon,4326) not null,
  source_key text,
  source_record_id text,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now()
);

create index if not exists hi_utility_service_areas_gix
  on public.hi_utility_service_areas using gist(geometry);

create table if not exists public.hi_public_water_systems (
  id uuid primary key default gen_random_uuid(),
  pws_id text not null unique,
  name text,
  activity_status text,
  system_type text,
  population_served integer,
  primary_source text,
  owner_type text,
  primacy_agency text,
  source_snapshot text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hi_water_results (
  id uuid primary key default gen_random_uuid(),
  pws_id text not null,
  sample_location_id text,
  contaminant_code text,
  contaminant_name text,
  sample_date date,
  result_value numeric,
  result_operator text,
  unit text,
  detection_limit numeric,
  result_type text not null default 'sample',
  source_key text not null,
  source_record_id text,
  created_at timestamptz not null default now()
);

create index if not exists hi_water_results_pws_idx
  on public.hi_water_results(pws_id, sample_date desc);

create table if not exists public.hi_water_violations (
  id uuid primary key default gen_random_uuid(),
  pws_id text not null,
  violation_id text not null,
  violation_code text,
  contaminant_code text,
  begin_date date,
  end_date date,
  resolved boolean,
  source_snapshot text,
  source_key text not null default 'epa_sdwa',
  created_at timestamptz not null default now(),
  unique(source_key, pws_id, violation_id, source_snapshot)
);

create table if not exists public.hi_permits (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid references public.hi_jurisdictions(id),
  property_id uuid references public.hi_properties(id),
  source_permit_number text not null,
  parcel_id text,
  property_address text,
  permit_type text,
  permit_subtype text,
  work_description text,
  trade text,
  system text,
  action text,
  classification_method text,
  classification_confidence numeric(4,3),
  application_date date,
  issue_date date,
  final_date date,
  expiration_date date,
  status text,
  declared_value numeric(14,2),
  contractor_license text,
  contractor_name text,
  owner_builder boolean,
  source_key text not null,
  source_record_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(jurisdiction_id, source_permit_number)
);

create index if not exists hi_permits_property_idx on public.hi_permits(property_id);
create index if not exists hi_permits_parcel_idx on public.hi_permits(parcel_id);
create index if not exists hi_permits_system_idx on public.hi_permits(system);
create index if not exists hi_permits_issue_idx on public.hi_permits(issue_date desc);

create table if not exists public.hi_property_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.hi_properties(id) on delete cascade,
  event_type text not null,
  event_subtype text,
  event_date date,
  source_key text not null,
  source_record_id text,
  confidence numeric(4,3) not null default 1.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hi_property_events_property_idx
  on public.hi_property_events(property_id, event_date desc);

create table if not exists public.hi_property_systems (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.hi_properties(id) on delete cascade,
  system_type text not null,
  installed_date date,
  installed_year smallint,
  installation_source text,
  installation_confidence numeric(4,3),
  estimated_age_years numeric(5,1),
  last_event_id uuid references public.hi_property_events(id),
  updated_at timestamptz not null default now(),
  unique(property_id, system_type)
);

create table if not exists public.hi_opportunity_scores (
  property_id uuid not null references public.hi_properties(id) on delete cascade,
  opportunity_type text not null,
  score smallint not null check (score between 0 and 100),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  classification text not null,
  model_version text not null,
  factors jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now(),
  primary key(property_id, opportunity_type)
);

-- Read-only public/API clients should never mutate canonical intelligence tables.
alter table public.hi_sources enable row level security;
alter table public.hi_ingestion_runs enable row level security;
alter table public.hi_raw_records enable row level security;
alter table public.hi_properties enable row level security;
alter table public.hi_jurisdictions enable row level security;
alter table public.hi_utilities enable row level security;
alter table public.hi_utility_service_areas enable row level security;
alter table public.hi_public_water_systems enable row level security;
alter table public.hi_water_results enable row level security;
alter table public.hi_water_violations enable row level security;
alter table public.hi_permits enable row level security;
alter table public.hi_property_events enable row level security;
alter table public.hi_property_systems enable row level security;
alter table public.hi_opportunity_scores enable row level security;

-- Seed authoritative V1 sources. source_priority: lower number wins conflicts.
insert into public.hi_sources(source_key, agency, dataset, source_url, source_priority)
values
 ('pbc_parcels', 'Palm Beach County', 'Parcel GIS', 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/Parcels/labels/MapServer/0', 10),
 ('pbc_boundaries', 'Palm Beach County', 'Municipal Boundaries', 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Boundaries_Open_Data/MapServer/5', 10),
 ('pbc_water_service_areas', 'Palm Beach County', 'Water Utility Service Areas', 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/Ags/5/MapServer/8', 10),
 ('fl_dor', 'Florida Department of Revenue', 'Property Assessment Roll', 'https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx', 20),
 ('epa_sdwa', 'U.S. EPA', 'SDWA/ECHO', 'https://echo.epa.gov/tools/data-downloads/sdwa-download-summary', 10),
 ('epa_ucmr5', 'U.S. EPA', 'UCMR 5', 'https://www.epa.gov/dwucmr/fifth-unregulated-contaminant-monitoring-rule-data-finder', 20),
 ('fl_dbpr', 'Florida DBPR', 'Construction Licensees', 'https://www2.myfloridalicense.com/construction-industry/public-records/', 10)
on conflict(source_key) do update set
 agency = excluded.agency,
 dataset = excluded.dataset,
 source_url = excluded.source_url,
 source_priority = excluded.source_priority,
 updated_at = now();
