-- Home Intelligence V1 — canonical permit ingestion

create or replace function public.hi_ingest_permit_batch(
  p_jurisdiction_name text,
  p_source_key text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jurisdiction_id uuid;
  v_count integer := 0;
  r jsonb;
  v_property_id uuid;
  v_parcel text;
begin
  insert into public.hi_jurisdictions(name, county, state, jurisdiction_type, source_key)
  values (p_jurisdiction_name, 'Palm Beach', 'FL', 'municipality', p_source_key)
  on conflict (state, county, name) do update set
    source_key = coalesce(hi_jurisdictions.source_key, excluded.source_key)
  returning id into v_jurisdiction_id;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if coalesce(r->>'permit_number','') = '' then continue; end if;

    v_parcel := upper(regexp_replace(coalesce(r->>'parcel_id',''), '[^0-9A-Za-z]', '', 'g'));
    v_property_id := null;
    if v_parcel <> '' then
      select id into v_property_id
      from public.hi_properties
      where parcel_id = v_parcel
      limit 1;
    end if;

    insert into public.hi_permits(
      jurisdiction_id, property_id, source_permit_number, parcel_id,
      property_address, permit_type, permit_subtype, work_description,
      trade, system, action, classification_method, classification_confidence,
      application_date, issue_date, final_date, expiration_date, status,
      declared_value, contractor_license, contractor_name, owner_builder,
      source_key, source_record_hash, first_seen_at, last_seen_at
    ) values (
      v_jurisdiction_id, v_property_id, r->>'permit_number', nullif(v_parcel,''),
      r->>'property_address', r->>'permit_type', r->>'permit_subtype', r->>'work_description',
      r->>'trade', r->>'system', r->>'action', r->>'classification_method',
      nullif(r->>'classification_confidence','')::numeric,
      nullif(r->>'application_date','')::date, nullif(r->>'issue_date','')::date,
      nullif(r->>'final_date','')::date, nullif(r->>'expiration_date','')::date,
      r->>'status', nullif(r->>'declared_value','')::numeric,
      r->>'contractor_license', r->>'contractor_name',
      case when r ? 'owner_builder' then (r->>'owner_builder')::boolean else null end,
      p_source_key, r->>'source_record_hash', now(), now()
    )
    on conflict (jurisdiction_id, source_permit_number) do update set
      property_id = coalesce(excluded.property_id, hi_permits.property_id),
      parcel_id = coalesce(excluded.parcel_id, hi_permits.parcel_id),
      property_address = coalesce(excluded.property_address, hi_permits.property_address),
      permit_type = coalesce(excluded.permit_type, hi_permits.permit_type),
      permit_subtype = coalesce(excluded.permit_subtype, hi_permits.permit_subtype),
      work_description = coalesce(excluded.work_description, hi_permits.work_description),
      trade = coalesce(excluded.trade, hi_permits.trade),
      system = coalesce(excluded.system, hi_permits.system),
      action = coalesce(excluded.action, hi_permits.action),
      classification_method = coalesce(excluded.classification_method, hi_permits.classification_method),
      classification_confidence = coalesce(excluded.classification_confidence, hi_permits.classification_confidence),
      application_date = coalesce(excluded.application_date, hi_permits.application_date),
      issue_date = coalesce(excluded.issue_date, hi_permits.issue_date),
      final_date = coalesce(excluded.final_date, hi_permits.final_date),
      expiration_date = coalesce(excluded.expiration_date, hi_permits.expiration_date),
      status = coalesce(excluded.status, hi_permits.status),
      declared_value = coalesce(excluded.declared_value, hi_permits.declared_value),
      contractor_license = coalesce(excluded.contractor_license, hi_permits.contractor_license),
      contractor_name = coalesce(excluded.contractor_name, hi_permits.contractor_name),
      owner_builder = coalesce(excluded.owner_builder, hi_permits.owner_builder),
      source_key = excluded.source_key,
      source_record_hash = excluded.source_record_hash,
      last_seen_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
