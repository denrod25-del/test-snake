---
title: Service Property Intelligence API - Plan
type: feat
date: 2026-08-15
topic: service-property-intelligence-api
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Service Property Intelligence API - Plan

## Goal Capsule

- **Objective:** Ship an on-demand Service Property Intelligence API that turns an address into one pre-dispatch briefing for a Palm Beach plumbing dispatcher — parcel basics, year built, building type, plumbing/permit history, equipment-age hints, flood, water/sewer when sourced, and first-pass opportunity scores — each field honestly labeled Live, Cached, Coming Soon, or unavailable.
- **Product authority:** This plan owns the briefing API plus first-pass opportunity scores in the same response. Surrounding areas (polished contractor UI; deeper prediction product) are not active scope.
- **Open blockers:** Who may call the API (open vs Pro vs API key) is unresolved — see Outstanding Questions.

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
- A2. Integrating system (HTTP client that requests a briefing by address)
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

### Key Flows

- F1. Pre-dispatch briefing lookup
  - **Trigger:** A2 has a next-job address from a service ticket (today: address + phone + reason only).
  - **Actors:** A1, A2, A3
  - **Steps:** Submit address → resolve parcel when possible → assemble parcel/flood/permit/utility fields with trust labels → compute first-pass opportunity hints from present fields → return one briefing.
  - **Outcome:** A1 can brief the tech with property context before dispatch.
  - **Covered by:** R1–R10

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
- Water/sewer utility is not currently a Live signal in `data/signals/catalog.json` — v1 treats it as Coming Soon unless planning finds an existing sourced field.
- Evidence that users “quit” incomplete tools is an assumption; specific abandoned product is unknown.
- yearBuilt is already extracted in Property Intelligence parcel enrichment even when not prominently rendered in the PI ownership panel.

### Outstanding Questions

**Resolve Before Planning**

- Q1. Who may call the API in v1: anonymous/public, DeedScout Pro (JWT) like `/api/rent-lookup`, or a separate API-key for shop integrations?

**Deferred to Planning**

- Q2. Exact HTTP path/shape and error model (address encoding, multi-match parcels, timeouts).
- Q3. Exact opportunity-score heuristics and presentation (numeric scores vs ranked reasons).
- Q4. Whether any response fields should deep-link to Property Intelligence or official portals for verification.

### Sources / Research

- Browser Property Intelligence: `property-intelligence.html`, `assets/property-intelligence.js` (parcel, flood, permits match; yearBuilt on parcel object).
- Trust catalog: `data/signals/catalog.json` (no water/sewer signal today; permits Cached for WPB/Boca/Jupiter/St. Lucie).
- Permit index honesty: `data/permits/index.json` (Palm Beach unincorporated sample/stale — not full bulk scrape).
- Existing Pro API pattern: `netlify.toml` redirects for `/api/skip-trace`, `/api/avm-lookup`, `/api/rent-lookup`.
- Grounding dossier (session): `/tmp/compound-engineering-1000/ce-brainstorm/spi-api/grounding.md`
