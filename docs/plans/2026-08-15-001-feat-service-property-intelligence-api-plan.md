---
title: Service Property Intelligence API - Plan
type: feat
date: 2026-08-15
topic: service-property-intelligence-api
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Service Property Intelligence API - Plan

## Goal Capsule

- **Objective:** Ship an on-demand Service Property Intelligence API that turns an address into one pre-dispatch briefing for a Palm Beach plumbing dispatcher — parcel basics, year built, building type, plumbing/permit history, equipment-age hints, flood, water/sewer when sourced, and first-pass opportunity scores — each field honestly labeled Live, Cached, Coming Soon, or unavailable.
- **Product authority:** This plan owns the briefing API plus first-pass opportunity scores in the same response. Surrounding areas (polished contractor UI; deeper prediction product) are not active scope. Product Contract R/A/F/AE IDs are authoritative for behavior; Planning Contract KTDs are authoritative for how.
- **Product Contract preservation:** restructured, no scope change: Deferred Planning Q1–Q4 resolved into KTD1–KTD7 (no R-ID splits).
- **Open blockers:** None.
- **Stop conditions:** Do not invent water/sewer or building-type values; do not scrape Sample/demo permit cities as Cached; do not reuse `requirePro` for this API; do not build polished contractor UI in this plan.
- **Execution profile:** Test-first for auth and response-shape units; characterization-style checks against known Palm Beach sample addresses for assemble accuracy.
- **Tail ownership:** Implementer owns applying Supabase migration in the project SQL Editor and issuing the first shop key; Netlify deploy follows normal `git push` to the site host.

## Product Contract

### Summary

A caller submits a street address and receives one JSON briefing assembled on demand from Live parcel/flood GIS (where wired) and Cached municipal permit data (where scraped), plus simple first-pass opportunity scores derived only from those fields. Missing sources are labeled honestly; inventing coverage is out of bounds.

### Problem Frame

Palm Beach plumbing dispatchers often send techs with only an address, phone number, and call reason. Public parcel, flood, and permit signals already exist in DeedScout’s Property Intelligence browser module, but there is no callable briefing API a dispatch workflow can use before the truck rolls. Prior tools were abandoned when the pre-call packet felt incomplete (assumption — specific product quit is unknown).

### Key Decisions

- **Own briefing API + scores; defer polished contractor UI** `(session-settled: user-directed — chosen over UI-first or predictions-only: foundation for dispatch value)` — Governs R1, R8.
- **On-demand assemble over precomputed dossiers or thin opportunity-only packet** `(session-settled: user-directed — chosen over B/C: matches accuracy-on-available success bar)` — Governs R2, R3.
- **Full briefing packet in v1, not a minimal strip** `(session-settled: user-directed — chosen over year-built+permits-only: dispatcher needs the full pre-call picture)` — Governs R4, R5, R6.
- **Geography: Palm Beach metro / already-covered permit cities first** — statewide completeness is not a v1 promise — Governs R7.
- **Opportunity scores are research hints, not job guarantees** — Governs R8, R9.
- **v1 access is shop API keys for plumbing-business integrations** `(session-settled: user-directed — chosen over anonymous or DeedScout Pro JWT: dispatch/CRM systems need a shop-scoped credential)` — Governs R11.

### How This Work Fits Together

<!-- ce-section: work-relationships -->

This plan owns the **Service Property Intelligence briefing API + first-pass scores**. The broader breakdown below is the current understanding, not a committed roadmap.

- Polished contractor / dispatcher product surface
  - **Depends on** this API’s briefing contract
  - **Can proceed independently of** deeper prediction work once the API exists
- Deeper predicted service-opportunity product (beyond first-pass scores)
  - **Depends on** stable briefing fields from this API
  - **Still to decide** scoring model, training data, and product packaging

### Actors

- A1. Palm Beach plumbing dispatcher (primary beneficiary; may call via a thin client, CRM, or future UI)
- A2. Integrating system (HTTP client that requests a briefing by address using a shop API key)
- A3. DeedScout data sources (parcel GIS, flood GIS, cached permit files, trust catalog)

### Requirements

**Address briefing**

- R1. A caller can request a property briefing by street address and receive a single structured response suitable for a pre-dispatch read.
- R2. The briefing is assembled on demand at request time from the best available sources for that address (not a stale precomputed dossier as the primary path).
- R3. Every major field group in the response carries an honest trust status (Live, Cached, Coming Soon, or unavailable) consistent with DeedScout’s existing data-trust practice.
- R4. When sources allow, the briefing includes: parcel identity, year built / property age, building type, plumbing-relevant permit history and prior work permits, likely equipment-age hints derived from permits and/or year built, flood zone, and water/sewer utility when a sourced field exists.
- R5. When a listed field has no sourced data for that address or geography, the response marks it Coming Soon or unavailable — it does not invent values.
- R6. Plumbing-relevant permits are highlighted; non-plumbing permits may appear as secondary history when present in the same sources.
- R7. v1 coverage targets Palm Beach County parcel/flood wiring plus municipal permit caches already in product (West Palm Beach, Boca Raton, Jupiter; St. Lucie when useful). Addresses outside coverage still return a structured response with unavailable/Coming Soon fields rather than a silent failure.

**Opportunity scores**

- R8. The same response includes first-pass opportunity scores or ranked hints derived only from briefing fields already present (for example aging systems inferred from year built and last plumbing permits).
- R9. Scores are labeled as research hints, not confirmed jobs or leads, and must not claim certainty beyond available inputs.

**Accuracy bar**

- R10. Success means fields that are populated are accurate relative to the cited available source; incomplete coverage is acceptable when labeled.

**Access**

- R11. v1 callers authenticate with a shop API key issued for plumbing-business integrations; unauthenticated requests are rejected.

### Key Flows

- F1. Pre-dispatch briefing lookup
  - **Trigger:** A2 has a next-job address from a service ticket (today: address + phone + reason only).
  - **Actors:** A1, A2, A3
  - **Steps:** Submit address → resolve parcel when possible → assemble parcel/flood/permit/utility fields with trust labels → compute first-pass opportunity hints from present fields → return one briefing.
  - **Outcome:** A1 can brief the tech with property context before dispatch.
  - **Covered by:** R1–R11

- F2. Partial-coverage address
  - **Trigger:** Address resolves but some sources (e.g. water/sewer, municipal permits) are missing.
  - **Actors:** A2, A3
  - **Steps:** Return whatever Live/Cached fields exist; mark missing groups Coming Soon/unavailable; still emit opportunity hints only from present inputs (or omit scores with an explicit unavailable label if no inputs exist).
  - **Outcome:** Caller sees an honest partial packet, not fabricated completeness.
  - **Covered by:** R3, R5, R7, R8, R9

### Acceptance Examples

- AE1. Covered municipal plumbing history
  - **Covers:** R1, R4, R6, R8
  - **Given:** An address in a city with Cached Tyler EnerGov permits and Live parcel GIS
  - **When:** The briefing is requested
  - **Then:** Year built and parcel identity are present when the PA GIS exposes them; plumbing permits are listed when matched; opportunity hints reference those inputs; each group has a trust label

- AE2. Water/sewer not sourced
  - **Covers:** R5, R10
  - **Given:** No water/sewer utility signal is available in DeedScout sources for the address
  - **When:** The briefing is requested
  - **Then:** Water/sewer is Coming Soon or unavailable — never a guessed utility name

- AE3. Outside permit scrape cities
  - **Covers:** R7, R5, R8
  - **Given:** A Palm Beach address with parcel/flood Live but no Cached municipal permit file match
  - **When:** The briefing is requested
  - **Then:** Parcel/flood (when wired) still return; permit history is unavailable/empty with label; opportunity scores use only remaining inputs or are labeled unavailable

### Success Criteria

- SC1. Populated fields match the cited available source for sample Palm Beach addresses used in verification.
- SC2. No response presents Coming Soon domains (notably water/sewer until sourced) as Live or Cached facts.
- SC3. A dispatcher-shaped reader can understand property age, last plumbing work, flood, and opportunity hints from one response without opening other DeedScout pages.

### Scope Boundaries

**In scope**

- On-demand briefing API by address
- First-pass opportunity scores in the same response
- Honest trust labeling and Palm Beach / covered-city focus

**Deferred for later**

- Polished contractor/dispatcher UI, SDK marketing surface, and CRM embeds
- Deeper prediction models beyond first-pass heuristics
- Statewide coverage beyond wired GIS + existing permit caches
- Water/sewer as Live/Cached until a real source is wired

**Outside this product's identity**

- Guaranteed job leads or sales promises from opportunity scores
- Replacing Property Intelligence’s investor/tax-deed browser module (this API is service/dispatch-oriented; PI may remain the browser research surface)

### Dependencies / Assumptions

- Existing Property Intelligence / parcel registry / flood layers / cached `data/permits/` are the primary sources for v1 assembly.
- Water/sewer utility is not currently a Live signal in `data/signals/catalog.json` — v1 treats it as Coming Soon unless a sourced field is found during implementation.
- Evidence that users “quit” incomplete tools is an assumption; specific abandoned product is unknown.
- yearBuilt is already extracted in Property Intelligence parcel enrichment even when not prominently rendered in the PI ownership panel.

### Outstanding Questions

**Resolve Before Planning**

- None.

**Deferred to implementation (non-blocking)**

- Q1. Exact multi-match parcel UX when ArcGIS returns several candidates (return `candidates[]` + 300-style payload vs auto-pick highest score).
- Q2. Whether St. Lucie permit cache is included in v1 assemble or Palm Beach cities only.

### Sources / Research

- Browser Property Intelligence: `property-intelligence.html`, `assets/property-intelligence.js` (parcel, flood, permits match; yearBuilt on parcel object).
- Trust catalog: `data/signals/catalog.json` (no water/sewer signal today; permits Cached for WPB/Boca/Jupiter/St. Lucie).
- Permit index honesty: `data/permits/index.json` (Palm Beach unincorporated sample/stale — not full bulk scrape).
- Existing Pro API pattern: `netlify.toml` redirects for `/api/skip-trace`, `/api/avm-lookup`, `/api/rent-lookup`.
- Repo pattern research (session): `/tmp/compound-engineering-1000/ce-plan-spi/repo-patterns.md`

## Planning Contract

### Key Technical Decisions

- KTD1. **Shop API keys in Supabase, hashed at rest** — table `shop_api_keys` (shop name, key prefix, SHA-256 hash, active flag, timestamps); plaintext shown once at issue time via a small Node seed/issue script. Do not reuse `requirePro`. Governs R11.
- KTD2. **`GET /api/property?address=…` (+ optional `county`)** with `X-Api-Key` or `Authorization: Bearer <shop-key>`; Netlify redirect to `/.netlify/functions/property-briefing`. Governs R1.
- KTD3. **Assemble permits from full Cached city JSON** under `data/permits/` for West Palm Beach, Boca Raton, Jupiter (active EnerGov caches) — not `data/signals/recent-permits.json`. Sample/stale cities stay Sample/unavailable. Governs R6, R7.
- KTD4. **Building type and water/sewer default to Coming Soon** when PA GIS / signals do not expose sourced fields — never invent. Governs R4, R5.
- KTD5. **First-pass opportunity hints as ranked reasons + coarse score 0–100** derived only from year built age bands and plumbing-permit recency/gaps (documented constants in code). Label `research_hint`. Governs R8, R9.
- KTD6. **Port PI assemble logic into CommonJS `_lib` modules** shared by the Netlify function; load static JSON via `included_files` and/or fetch from the deployed site origin. Extend CORS Allow-Headers for API key headers. Governs R2, R3.
- KTD7. **Key-scoped rate limit** wrapping `_lib/rate-limit.js` (per shop key id, best-effort in-memory) plus standard error JSON `{ error, message }`. Governs R11.

### High-Level Design

```text
Client (CRM/dispatch)
  --GET /api/property?address=... + X-Api-Key-->
Netlify property-briefing
  -> requireShopApiKey (Supabase hash lookup)
  -> lookupParcel (registry + ArcGIS, port of PI)
  -> lookupFlood (flood-layers.json + ArcGIS)
  -> matchCityPermits (full data/permits/*.json)
  -> opportunityHints (yearBuilt + plumbing permits)
  <- JSON briefing { groups: { parcel, building, permits, equipmentAge, flood, waterSewer, opportunities }, links }
```

Response groups (each with `status` + `source` + payload): `parcel`, `building`, `permits`, `equipmentAge`, `flood`, `waterSewer`, `opportunities`. Optional `links` to Property Intelligence deep-link and official portals when known.

### Assumptions

- Supabase service role is available to Netlify functions (same as existing auth helpers).
- ArcGIS endpoints used by browser PI are reachable from Netlify function egress.
- Full permit JSON files (~few MB each) can be bundled via `included_files` or fetched from the same Netlify publish root without exceeding practical cold-start budgets; if bundling is too heavy, prefer HTTP fetch of published static files.
- First shop keys are issued operationally (script/SQL), not via a customer self-serve UI in this plan.

### Implementation Constraints

- `netlify/functions/package.json` stays `"type": "commonjs"`.
- Do not re-add Vercel config; deploy remains Netlify root publish.
- Preserve honest Sample vs Cached distinctions from `data/permits/index.json`.
- Do not spend Pro credits or call BatchData/RentCast for this endpoint.

### Sequencing

1. U1 shop key schema + auth helper (unblocks everything)
2. U2 parcel/flood assemble libs
3. U3 permit match libs
4. U4 opportunity heuristics
5. U5 HTTP handler + redirect + CORS
6. U6 tests + issue-key script + docs note

### Research Inputs

- Handler/error pattern: `netlify/functions/rent-lookup.js`, `netlify/functions/_lib/auth.js`
- Rate limit: `netlify/functions/_lib/rate-limit.js`
- Parcel/flood/permit browser logic: `assets/property-intelligence.js`
- Parcel registry: `data/parcels/registry.json`
- Permit coverage: `data/permits/index.json`, `data/signals/catalog.json`
- Trust labels: `assets/data-trust.js`
- Institutional: `AGENTS.md` (Netlify deploy, trust labels); no `docs/solutions/` corpus

## Implementation Units

### U1. Shop API key storage and auth helper

- **Goal:** Authenticate SPI callers with hashed shop API keys; reject missing/invalid keys.
- **Requirements:** R11
- **Files:** `supabase/migrations/YYYYMMDD_shop_api_keys.sql`, `supabase/schema.sql` (append), `netlify/functions/_lib/shop-auth.js`, `scripts/issue-shop-api-key.mjs` (or `.js`)
- **Approach:** Create `shop_api_keys` with `id`, `shop_name`, `key_prefix`, `key_hash` (unique), `active`, timestamps. Issue script generates `ds_shop_…` secret, stores SHA-256 hash + prefix, prints plaintext once. `requireShopApiKey(event)` reads `X-Api-Key` or Bearer token, hashes, looks up active row via service role, returns `{ shop, error }`. Extend CORS helper used by SPI to allow `Authorization, X-Api-Key, Content-Type`.
- **Dependencies:** None
- **Test scenarios:**
  - Missing key → 401
  - Invalid key → 401
  - Inactive key → 401/403
  - Valid key → shop context returned
  - Issue script round-trip: generated plaintext authenticates after insert
- **Verification:** Unit tests for hash/extract/lookup with mocked Supabase client; migration applies cleanly in SQL Editor docs note.

### U2. Parcel and flood assemble libraries

- **Goal:** Resolve address → parcel (+ year built) and flood zone with trust labels for Palm Beach wiring.
- **Requirements:** R2, R3, R4, R5, R7, R10
- **Files:** `netlify/functions/_lib/spi-parcel.js`, `netlify/functions/_lib/spi-flood.js`, `data/parcels/registry.json` (read), `data/signals/flood-layers.json` (read)
- **Approach:** Port `lookupParcel` / `lookupFlood` / `pick` / centroid helpers from `assets/property-intelligence.js` into CommonJS. Default county `palm-beach` when omitted. Building type field returns Coming Soon unless a sourced attribute exists in registry field maps. Multi-match: return structured `candidates` and do not silently invent a single parcel (defer polish per Q1 — prefer explicit multi-match payload).
- **Dependencies:** None (can parallelize with U1)
- **Test scenarios:**
  - Known PBC address returns parcel id + yearBuilt when GIS exposes them (`status: live`)
  - Timeout / GIS error → group `unavailable` with message, no throw to client as 500 if partial packet still possible
  - Flood zone populated when NFHL/county layer returns FLD_ZONE
  - Building type Coming Soon when unmapped
- **Verification:** Unit tests with fixture ArcGIS JSON; optional live smoke behind network (document as manual).

### U3. Municipal permit match and plumbing filter

- **Goal:** Attach Cached plumbing-relevant and secondary permits from full city files.
- **Requirements:** R3, R4, R6, R7
- **Files:** `netlify/functions/_lib/spi-permits.js`, `data/permits/index.json`, `data/permits/west-palm-beach.json`, `data/permits/boca-raton.json`, `data/permits/jupiter.json`, `netlify.toml` (`[functions."property-briefing"] included_files` or fetch strategy)
- **Approach:** Load/index permits by normalized address and/or parcel id from active cities only. Classify plumbing vs other via keyword/type heuristics aligned with Plumbing Watch concepts. Never treat Sample/stale index entries as Cached. Equipment-age hints: last plumbing permit date + yearBuilt deltas.
- **Dependencies:** U2 helpful for parcel id matching; can stub address-only match first
- **Test scenarios:**
  - Address in WPB with known plumbing permit appears under plumbing list (`status: cached`)
  - Non-plumbing permit appears only in secondary history
  - Address outside cities → permits group unavailable/empty Cached miss with honest label
  - Sample city data never labeled Cached
- **Verification:** Fixture subset of permit JSON in tests; assert match + labels.

### U4. First-pass opportunity hints

- **Goal:** Ranked research hints + coarse score from present briefing fields only.
- **Requirements:** R8, R9
- **Files:** `netlify/functions/_lib/spi-opportunities.js`
- **Approach:** Deterministic rules, e.g. property age > N years without recent water-heater/repipe permit → higher hint; recent plumbing permit → lower replacement urgency; flood SFHA → flood-prep hint only if flood group live. Always set `label: research_hint` and `disclaimer` string. If no inputs, `status: unavailable`.
- **Dependencies:** U2/U3 field shapes
- **Test scenarios:**
  - Old yearBuilt + no plumbing permits → non-empty ranked hints, score > mid
  - Recent water heater permit → reduced water-heater replacement hint
  - Empty inputs → unavailable opportunities, no fabricated scores
  - Output never claims “confirmed job” / lead language
- **Verification:** Pure unit tests on fixtures.

### U5. `property-briefing` handler and route

- **Goal:** Expose `GET /api/property` assembling one briefing JSON for authenticated shops.
- **Requirements:** R1–R11, F1, F2, AE1–AE3, SC1–SC3
- **Files:** `netlify/functions/property-briefing.js`, `netlify.toml` (redirect + included_files), `netlify/functions/_lib/auth.js` or shared cors export update, `data/signals/catalog.json` (optional SPI note), `llms.txt` or short `docs`/README blurb optional
- **Approach:** OPTIONS + GET only. Auth via U1. Rate-limit via KTD7. Query `address` required, `county` optional. Orchestrate U2–U4; always return 200 with partial groups when auth ok (except 400 missing address, 401 auth, 429 rate limit). Include `links.propertyIntelligence` deep-link when parcel/county known. Water/sewer group Coming Soon per KTD4.
- **Dependencies:** U1–U4
- **Test scenarios:**
  - AE1 happy path shape with mocked libs
  - AE2 waterSewer Coming Soon
  - AE3 permits unavailable, parcel/flood present
  - Unauthenticated → 401
  - Missing address → 400
  - Rate limit exceeded → 429
- **Verification:** Handler tests with mocked `_lib`; manual curl against Netlify dev or deploy preview after key issue (note: checkout/auth production caveats do not block this shop-key API).

### U6. Issue-key script, docs, and public-site QA hooks

- **Goal:** Operators can issue a shop key; public QA knows the route exists without claiming Live water/sewer.
- **Requirements:** R11, R10, SC2
- **Files:** `scripts/issue-shop-api-key.mjs`, `SETUP.md` (short section), `scraper/tests/test_public_site.py` or `tests/` smoke asserting `/api/property` redirect/function presence without requiring live GIS
- **Approach:** Document env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`). Add a minimal public-site assertion that the redirect exists in `netlify.toml`. Do not add polished contractor UI.
- **Dependencies:** U1, U5
- **Test scenarios:**
  - `netlify.toml` contains `/api/property` redirect
  - SETUP documents issue script usage
  - Optional: public site test does not regress on unrelated pages
- **Verification:** Run existing public-site pytest subset plus new assertions.

## Verification Contract

- **Unit / handler tests:** Prefer `node --test` on colocated `netlify/functions/_lib/*.test.js` and `property-briefing` tests (Node’s built-in test runner; root `package.json` today only has `test:e2e` for Puppeteer). Add `tests/spi/` fixtures as needed.
- **Public site QA:** `python -m pytest scraper/tests/test_public_site.py -q` (extend minimally for redirect presence / no false Live water-sewer claims in any new docs pages).
- **E2E (optional):** `npm run test:e2e` remains the existing Puppeteer permit-search gate — do not repurpose it for SPI unless a dedicated SPI e2e is added later.
- **Manual smoke (post-deploy):** Issue one shop key; `curl -H "X-Api-Key: …" "https://<host>/api/property?address=<known-WPB-address>"` and confirm trust labels + plumbing permits when expected.
- **Do not** treat Netlify deploy-preview Stripe/Supabase Pro checkout as required for this API (shop keys are independent); prefer production host only if that is where service role + keys are configured.

## Definition of Done

- All units U1–U6 complete with their listed test scenarios passing.
- Product Contract R1–R11 satisfied for Palm Beach / covered-city focus.
- No polished contractor UI shipped.
- Water/sewer and unsourced building type never presented as Live/Cached facts.
- Migration + issue-key path documented in `SETUP.md`.
- Plan PR / implementation PR ready for review with honest trust behavior demonstrated on at least one Cached permit city address.
