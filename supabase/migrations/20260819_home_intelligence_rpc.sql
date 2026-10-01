-- Spatial helpers for Home Intelligence V1.

create or replace function public.hi_resolve_water_utility(p_property_id uuid)
returns table (
  utility_id uuid,
  utility_name text,
  utility_phone text,
  epa_pws_id text,
  source_key text,
  source_record_id text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.name,
    u.phone,
    u.epa_pws_id,
    a.source_key,
    a.source_record_id
  from public.hi_properties p
  join public.hi_utility_service_areas a
    on p.centroid is not null
   and st_intersects(a.geometry, p.centroid::geometry)
  join public.hi_utilities u on u.id = a.utility_id
  where p.id = p_property_id
    and u.utility_type = 'potable_water'
  order by a.valid_to nulls first, a.created_at desc
  limit 1;
$$;

revoke all on function public.hi_resolve_water_utility(uuid) from public;
grant execute on function public.hi_resolve_water_utility(uuid) to service_role;
