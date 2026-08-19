# Home Intelligence V1 — Runbook

## Implemented

- Canonical Postgres/PostGIS schema, provenance, raw records, and ingestion runs
- Resumable Palm Beach parcel ingestion with batch writes
- Palm Beach water utility service-area ingestion
- Spatial property → utility resolver
- EPA SDWA quarterly snapshot schema and batch ingestion RPCs
- EPA UCMR 5 occurrence-result ingestion (kept separate from violation status)
- Streaming EPA CSV/TXT importer
- Verified utility → PWS link table
- Canonical permit batch ingestion
- Importer for existing active DeedScout permit caches: West Palm Beach, Boca Raton, Jupiter
- Rule-v1 permit classification for water heater, repipe, sewer, backflow, filtration, roof, and HVAC
- API-key protected `hi-property-v1`, `hi-water-v1`, `hi-permits-v1`, and `hi-opportunities-v1`
- POST-only parcel/water ingestion handlers protected by `HI_INGEST_SECRET`

## Database migration order

Apply only to DeedScout Supabase project `wmkbksqztpofxoqbyrdd`:

1. `supabase/migrations/20260819_home_intelligence_v1.sql`
2. `supabase/migrations/20260819_home_intelligence_spatial.sql`
3. `supabase/migrations/20260819_home_intelligence_ingest.sql`
4. `supabase/migrations/20260819_home_intelligence_epa.sql`
5. `supabase/migrations/20260819_home_intelligence_permits.sql`

The Supabase project is not currently exposed through this session's connected Supabase workspace. Do not apply these migrations to another project.

## Required environment

Existing DeedScout server environment must provide its Supabase service credentials. Add a high-entropy `HI_INGEST_SECRET` to staging Netlify and never expose it to browser code.

## Initial ingestion sequence

### 1. Water service areas

```bash
curl -X POST -H "X-Ingest-Secret: $HI_INGEST_SECRET" \
  https://<staging-host>/.netlify/functions/hi-ingest-pbc-water
```

### 2. Parcel bootstrap

Start small and let the durable cursor resume automatically:

```bash
curl -X POST -H "X-Ingest-Secret: $HI_INGEST_SECRET" \
  "https://<staging-host>/.netlify/functions/hi-ingest-pbc-parcels?pageSize=100"
```

Increase toward 500–1000 per invocation only after timing the staging run.

### 3. Existing permit caches

```bash
SUPABASE_URL=https://wmkbksqztpofxoqbyrdd.supabase.co \
SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY" \
node scripts/home-intelligence/import-existing-permits.mjs
```

Only active Palm Beach feeds are imported. Sample/blocked sources are excluded.

### 4. EPA SDWA

Download/extract the official quarterly EPA SDWA ZIP, then run:

```bash
node scripts/home-intelligence/import-epa.mjs sdwa-pws ./SDWA_PUB_WATER_SYSTEMS.csv
node scripts/home-intelligence/import-epa.mjs sdwa-violations ./SDWA_VIOLATIONS_ENFORCEMENT.csv
```

The importer streams national files and keeps only Florida rows. PWS history is preserved by `PWSID + SUBMISSIONYEARQUARTER`.

### 5. EPA UCMR 5 / PFAS

Download/extract the official UCMR 5 occurrence text data, then run:

```bash
node scripts/home-intelligence/import-epa.mjs ucmr5 ./UCMR5_All.txt
```

UCMR occurrence is stored as measurement data, not automatically labeled a regulatory violation.

### 6. Utility → PWS mapping

Populate `hi_utility_pws_links` using verified utility/PWS evidence. Do not guess PWS identity from ZIP or city alone.

## Validation

```sql
select count(*) from public.hi_properties;
select count(*) from public.hi_utilities;
select count(*) from public.hi_utility_service_areas;
select count(*) from public.hi_permits;
select count(*) from public.hi_public_water_systems;
select count(*) from public.hi_water_results;
select count(*) from public.hi_water_violations;
select * from public.hi_ingestion_cursors order by source_key;
select * from public.hi_ingestion_runs order by started_at desc limit 20;
```

Spatial test:

```sql
select * from public.hi_find_water_utility_for_property('<PROPERTY_UUID>');
```

Permit classification test:

```sql
select system, action, count(*) from public.hi_permits
where system is not null group by system, action order by count(*) desc;
```

## Smoke-test order

1. `hi-property-v1`
2. `hi-water-v1` after utility/PWS linking
3. `hi-permits-v1`
4. Store at least one opportunity score
5. `hi-opportunities-v1`

Only then add friendly `/api/v1/*` routes and begin incremental DeedScout/WIYW cutover.

## Next sources

- Florida DOR assessment roll enrichment
- FDEP PWS facilities / plants / wells
- SFWMD treatment plants / wellfields
- CCR ingestion with page-level provenance
- DBPR contractor-license bulk data
- Long-history municipal permit exports / Chapter 119 records
- Boil-water notice event pipeline

## Architecture rule

`source record -> canonical fact -> property event/system state -> derived opportunity score`

Every derived score must carry a model version, confidence, and evidence factors.
