# Home Intelligence V1 — Runbook

## Status

This branch contains the shared backend foundation for DeedScout, Florida WIYW, and future API consumers.

### Implemented

- Canonical Postgres/PostGIS schema
- Source provenance and ingestion-run tables
- Resumable ingestion cursor table
- Batch PostGIS RPCs for parcel and water-service-area ingestion
- Palm Beach County parcel ArcGIS adapter
- Palm Beach County water utility service-area ArcGIS adapter
- API-key protected V1 handlers: `hi-property-v1`, `hi-water-v1`, `hi-permits-v1`, `hi-opportunities-v1`
- Protected ingestion handlers: `hi-ingest-pbc-parcels`, `hi-ingest-pbc-water`

## Production safety

Do **not** deploy the ingestion handlers without setting `HI_INGEST_SECRET` in Netlify. Both handlers are POST-only and require the `X-Ingest-Secret` header.

Do **not** point Florida WIYW or the public DeedScout UI at the V1 handlers until the canonical tables are populated and smoke-tested.

## Database migration order

Apply to the DeedScout Supabase project in this order:

1. `supabase/migrations/20260819_home_intelligence_v1.sql`
2. `supabase/migrations/20260819_home_intelligence_spatial.sql`
3. `supabase/migrations/20260819_home_intelligence_ingest.sql`

The DeedScout backend currently references Supabase project `wmkbksqztpofxoqbyrdd`. The currently connected Supabase tool workspace does not expose that project, so migrations must not be applied to another project by mistake.

## Required Netlify environment

Existing DeedScout server environment must continue to provide its Supabase service credentials. Add `HI_INGEST_SECRET` as a high-entropy private secret used only by ingestion calls. Never expose it in frontend code.

## Initial ingestion sequence

### 1. Water service areas

Run once after migrations:

```bash
curl -X POST \
  -H "X-Ingest-Secret: $HI_INGEST_SECRET" \
  https://<staging-host>/.netlify/functions/hi-ingest-pbc-water
```

Expected result: `hi_utilities` and `hi_utility_service_areas` populate, raw source records are preserved, and an ingestion run is logged.

### 2. Parcel bootstrap

Start with a small page:

```bash
curl -X POST \
  -H "X-Ingest-Secret: $HI_INGEST_SECRET" \
  "https://<staging-host>/.netlify/functions/hi-ingest-pbc-parcels?pageSize=100"
```

Increase toward 500–1000 records per invocation based on observed execution time. The function resumes automatically from `hi_ingestion_cursors.cursor_value`.

To explicitly restart from offset 0, add `restart=1`. Do not use that during a normal bootstrap.

## Validation queries

```sql
select count(*) from public.hi_properties;
select count(*) from public.hi_utilities;
select count(*) from public.hi_utility_service_areas;
select * from public.hi_ingestion_cursors order by source_key;
select * from public.hi_ingestion_runs order by started_at desc limit 20;
```

Validate a property-to-utility spatial match after parcels exist:

```sql
select * from public.hi_find_water_utility_for_property('<PROPERTY_UUID>');
```

## Smoke-test order

1. `hi-property-v1` with a known Palm Beach parcel ID
2. `hi-water-v1` for the same property
3. Import one permit jurisdiction
4. `hi-permits-v1`
5. Generate at least one stored opportunity score
6. `hi-opportunities-v1`

Only after these tests pass should friendly `/api/v1/*` routes be added to `netlify.toml`.

## Next data sources

1. Florida DOR property roll enrichment
2. EPA SDWA quarterly bulk data
3. EPA UCMR 5 PFAS data
4. Utility-to-PWS ID mapping
5. Boca Raton permit download
6. Palm Beach / municipal permit bulk exports
7. DBPR contractor-license bulk records

## Architecture rule

Maintain this separation:

`source record -> canonical fact -> property event/system state -> derived opportunity score`

Every derived score must include a model version, confidence, and evidence factors.
