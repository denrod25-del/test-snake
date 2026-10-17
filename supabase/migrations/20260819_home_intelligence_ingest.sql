-- Home Intelligence V1 ingestion helpers

create table if not exists public.hi_ingestion_cursors (
  source_key text primary key,
  cursor_value bigint not null default 0,
  completed boolean not null default false,
  last_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.hi_ingestion_cursors enable row level security;

create or replace function public.hi_upsert_property_from_geojson(
  p_parcel_id text,
  p_site_address text,
  p_site_address_normalized text,
  p_street_number text,
  p_street_name text,
  p_street_suffix text,
  p_city text,
  p_municipality text,
  p_postal_code text,
  p_property_use_description text,
  p_acres numeric,
  p_market_value numeric,
  p_assessed_value numeric,
  p_taxable_value numeric,
  p_last_sale_date date,
  p_last_sale_price numeric,
  p_geojson jsonb,
  p_source_record_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_geom geometry(multipolygon,4326);
begin
  if p_geojson is not null then
    v_geom := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326));
  end if;

  insert into public.hi_properties (
    parcel_id, site_address, site_address_normalized,
    street_number, street_name, street_suffix,
    city, municipality, postal_code, property_use_description,
    acres, market_value, assessed_value, taxable_value,
    last_sale_date, last_sale_price,
    geometry, centroid,
    source_key, source_record_id, source_updated_at, updated_at
  ) values (
    p_parcel_id, p_site_address, p_site_address_normalized,
    p_street_number, p_street_name, p_street_suffix,
    p_city, p_municipality, p_postal_code, p_property_use_description,
    p_acres, p_market_value, p_assessed_value, p_taxable_value,
    p_last_sale_date, p_last_sale_price,
    v_geom,
    case when v_geom is null then null else ST_Centroid(v_geom)::geography end,
    'pbc_parcels', p_source_record_id, now(), now()
  )
  on conflict (state, county, parcel_id) do update set
    site_address = excluded.site_address,
    site_address_normalized = excluded.site_address_normalized,
    street_number = excluded.street_number,
    street_name = excluded.street_name,
    street_suffix = excluded.street_suffix,
    city = excluded.city,
    municipality = excluded.municipality,
    postal_code = excluded.postal_code,
    property_use_description = excluded.property_use_description,
    acres = excluded.acres,
    market_value = excluded.market_value,
    assessed_value = excluded.assessed_value,
    taxable_value = excluded.taxable_value,
    last_sale_date = excluded.last_sale_date,
    last_sale_price = excluded.last_sale_price,
    geometry = coalesce(excluded.geometry, hi_properties.geometry),
    centroid = coalesce(excluded.centroid, hi_properties.centroid),
    source_key = excluded.source_key,
    source_record_id = excluded.source_record_id,
    source_updated_at = excluded.source_updated_at,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.hi_replace_utility_service_area(
  p_name text,
  p_phone text,
  p_source_record_id text,
  p_geojson jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utility_id uuid;
  v_geom geometry(multipolygon,4326);
begin
  v_geom := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326));

  insert into public.hi_utilities(name, utility_type, phone, source_key, source_record_id, updated_at)
  values (p_name, 'potable_water', p_phone, 'pbc_water_service_areas', p_source_record_id, now())
  on conflict (name, utility_type) do update set
    phone = excluded.phone,
    source_key = excluded.source_key,
    source_record_id = excluded.source_record_id,
    updated_at = now()
  returning id into v_utility_id;

  delete from public.hi_utility_service_areas
  where utility_id = v_utility_id
    and source_key = 'pbc_water_service_areas'
    and source_record_id = p_source_record_id;

  insert into public.hi_utility_service_areas(
    utility_id, geometry, source_key, source_record_id
  ) values (
    v_utility_id, v_geom, 'pbc_water_service_areas', p_source_record_id
  );

  return v_utility_id;
end;
$$;

create or replace function public.hi_upsert_properties_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_count integer := 0;
begin
  for r in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    perform public.hi_upsert_property_from_geojson(
      r->>'parcel_id', r->>'site_address', r->>'site_address_normalized',
      r->>'street_number', r->>'street_name', r->>'street_suffix',
      r->>'city', r->>'municipality', r->>'postal_code', r->>'property_use_description',
      nullif(r->>'acres','')::numeric,
      nullif(r->>'market_value','')::numeric,
      nullif(r->>'assessed_value','')::numeric,
      nullif(r->>'taxable_value','')::numeric,
      nullif(r->>'last_sale_date','')::date,
      nullif(r->>'last_sale_price','')::numeric,
      r->'geometry', r->>'source_record_id'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.hi_replace_utility_service_areas_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_count integer := 0;
begin
  for r in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    perform public.hi_replace_utility_service_area(
      r->>'name', r->>'phone', r->>'source_record_id', r->'geometry'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
