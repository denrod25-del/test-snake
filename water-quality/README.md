# Florida Water Quality API

A standardized read-only API over Florida drinking-water data, normalizing EPA
SDWIS, EPA UCMR 5 (PFAS), utility Consumer Confidence Reports, SDWA violations,
and boil-water notices into one schema with one set of units and one analyte
vocabulary — plus ZIP/city → utility resolution.

Python pipeline in `water-quality/`, published JSON in `data/water/`, served by
`netlify/functions/water-api.js` at `/api/water/*`.

## Current state

| Piece | State |
|---|---|
| Normalization core (units, analytes, schema) | Done, 99 tests passing |
| Source clients (SDWIS, UCMR 5, CCR, notices) | Done, exercised against a fake transport |
| Normalizers + ZIP index + profile assembly | Done |
| HTTP API + routing + CI ingest workflow | Done |
| Analyte dictionary (`/api/water/analytes`) | **Live now** — 81 analytes, committed |
| Everything upstream-dependent | **Not yet populated** — see below |

**The upstream data has not been ingested yet.** The build environment this was
developed in blocks outbound access to `data.epa.gov`, `floridadep.gov`,
`prodenv.dep.state.fl.us`, and `echodata.epa.gov` at the network-policy layer
(HTTP 403 on CONNECT — see `data/water/source-probe.json`). GitHub Actions
runners are not subject to that policy, which is why the ingest runs there.

Until the first ingest completes, `/api/water/systems`, `/api/water/system`,
and `/api/water/lookup` return **HTTP 503** with `status: "coming-soon"` and an
explanation. They do not return empty lists, and they do not return invented
numbers.

To populate it:

```
Actions → "Ingest Florida Water Quality" → Run workflow → resolve: true
```

Then **review `fwq/data/utilities.lock.json` before trusting the output** (see
[PWSID resolution](#pwsid-resolution)).

## Quick start

```bash
cd water-quality
pip install -r requirements.txt

python -m fwq probe                  # which sources are reachable from here?
python -m fwq resolve                # utility configs -> PWSIDs (writes lockfile)
python -m fwq ingest                 # full pipeline -> ../data/water/
python -m fwq validate               # check the published output
python -m fwq lookup --zip 33410     # query the built index locally
python -m fwq dictionary             # publish just the analyte table (no network)
```

Tests (hermetic — no network, synthetic fixtures):

```bash
npm run test:water                   # from the repo root: Python + API suites
```

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/water/health` | dataset freshness, per-source status, record counts |
| `GET /api/water/analytes` | the analyte dictionary; `?group=pfas`, `?id=pfoa` |
| `GET /api/water/utilities` | utilities built out end to end |
| `GET /api/water/systems` | inventory; `?county=`, `?zip=`, `?type=`, `?q=`, `?limit=`, `?offset=` |
| `GET /api/water/system?pwsid=FL…` | one system's full profile |
| `GET /api/water/lookup?zip=33410` | ranked candidate utilities; `&city=` narrows |

All are public, CORS-open, GET-only, and rate-limited to 120 req/min per IP.
Every payload carries a `meta` block with a data-trust status matching
`assets/data-trust.js` (`live` / `cached` / `sample` / `blocked` / `broken` /
`coming-soon`).

## The normalization contract

This is the part that makes it an API rather than a proxy.

**One analyte vocabulary.** `fwq/data/analytes.json` maps every name any source
emits onto one canonical id. `PFOA`, `Perfluorooctanoic acid`, `PFOA (C8)`, and
CASRN `335-67-1` all resolve to `pfoa`. Resolution tries CASRN, then id, then
name/alias, then EPA's numeric SDWIS contaminant code — which is *learned* from
EPA's own `ref_code_values` reference table at ingest time rather than guessed.

**One set of units.** UCMR 5 reports PFAS in µg/L, CCRs print them as ppt,
SDWIS uses mg/L for lead. `fwq/units.py` converts within a dimension and
*refuses* across one, so `mg/L → pCi/L` raises instead of producing a number.
Every result keeps its original `reportedValue`/`reportedUnit` alongside the
canonical pair.

**Non-detects are not zeros.** A result carries `detected`, `censoring`, and
`detectionLimit` as separate fields. UCMR 5 encodes a non-detect as
`AnalyticalResultsSign = "<"` with the MRL sitting in the value column; reading
that value as a measurement would invent a detection at the reporting limit for
every clean sample in the dataset. A non-detect never produces a limit
comparison and can never be reported as an exceedance — `python -m fwq validate`
fails the build if one ever does.

**Nothing disappears silently.** Every dropped row lands in
`data/water/ingest-report.json` with a reason, and unmapped contaminant names
are counted there. A quietly shorter dataset is indistinguishable from a clean
one.

**Provenance on every record.** Source system, source URL, retrieval timestamp,
and upstream row id. A number without a citation is not publishable.

**PFAS Hazard Index.** EPA's mixture rule (`sum(measured / HBWC) ≤ 1` across
PFHxS, PFNA, HFPO-DA, PFBS) is computed per system. It distinguishes "measured,
non-detect" (contributes zero) from "never sampled" (marks the index
`complete: false`), so a partial index is never mistaken for a clean one.

## ZIP → utility, honestly

**A ZIP code does not determine your water utility.** ZIPs are mail routes;
service areas are pipe networks. A single Florida ZIP is routinely served by
several systems, and SDWIS's `zip_code_served` is self-reported with no geometry
behind it.

So `/api/water/lookup` returns a *ranked list* with a `confidence` per candidate
and an `isDefinitive` flag that is only true when exactly one system serves the
ZIP. Ranking prefers community systems over transient ones (a campground on the
same ZIP is not your utility), boosts a city match, and penalizes inactive
systems. Each candidate carries the reasons it was proposed.

Address resolution (`fwq.geo.resolve_address`) geocodes via the Census Bureau
and then falls back to ZIP+city, labelling itself `geocode+zip+city`. Real
point-in-polygon resolution needs service-area geometry from FDEP or utility
GIS — tracked as `fdep-geodata` in `fwq/data/sources.json` and not yet
confirmed reachable.

## PWSID resolution

Utility configs in `fwq/data/utilities/` deliberately ship with `"pwsid": null`.

Attaching results to the wrong PWSID would show one community another
community's PFAS numbers and violations, and a nine-character identifier typed
from memory is exactly the kind of thing that is wrong without looking wrong. So
a PWSID enters the system only by being resolved against SDWIS by name, scored
against the config's stated expectations (system type, county, minimum
population, active status), and written to `fwq/data/utilities.lock.json`
together with the runners-up that were rejected.

Confidence is conservative: only `high` is applied automatically, `low` is
refused outright, and a changed PWSID is visible in the lockfile diff. Review
that diff — it reassigns every record for that utility.

## Seacoast Utility Authority

`fwq/data/utilities/seacoast.json` is the first end-to-end build-out: name
aliases, resolution expectations (Palm Beach County, CWS, ≥50k population),
candidate CCR index and alerts pages, and a priority analyte panel (the six
regulated PFAS, TTHM, HAA5, lead, copper, chlorine, hardness, sodium) that leads
its profile.

Its PWSID, CCR URLs, and alerts page are all **unresolved/unverified** and
marked as such — `/api/water/utilities` withholds the website URL entirely
rather than publish an unprobed link. Running `resolve` + `ingest` in CI fills
all of it in. No lab values for Seacoast, or any real utility, exist anywhere in
this repo; they only ever arrive by being fetched from a cited source.

## Layout

```
water-quality/
  fwq/
    units.py            unit registry, dimensions, conversion
    analytes.py         analyte registry, resolution, Hazard Index
    schema.py           canonical record types + serialization
    normalize.py        raw rows -> canonical records
    geo.py              ZIP/city/address -> utility
    utilities.py        utility configs, PWSID resolution, lockfile
    build.py            ingest orchestration + dataset writing
    __main__.py         CLI
    sources/
      http.py           caching/retrying client, SourceUnavailable
      envirofacts.py    SDWIS + UCMR 5
      ccr.py            CCR parsing (pure core + document adapters)
      notices.py        boil-water notice classification + manual entry
    data/
      analytes.json     the analyte dictionary  <- the normalization contract
      sources.json      upstream source registry with verification state
      utilities/        per-utility configs
      utilities.lock.json  resolved PWSIDs (generated, reviewable)
  tests/                unittest suites + Node API suite
```

## Known gaps

- **No upstream data ingested yet** — blocked by egress policy here; run the CI
  workflow.
- **FDEP is registered but unwired.** Florida holds SDWA primacy, so FDEP's
  facility-level data is fresher than the federal SDWIS extract. Both candidate
  endpoints in `sources.json` are unconfirmed and form-driven; confirm by probe
  before building an ingest against them.
- **No service-area geometry**, so address lookup is ZIP-accurate at best.
- **Boil-water notices have no statewide feed.** The classifier and manual-entry
  path work; per-utility scraping needs each alerts page confirmed individually.
- **CCR parsing is untested against a real document.** The value-parsing core is
  well covered, but no actual utility PDF has been run through it — layouts vary
  enough that the first real ones will need iteration.
- **Regulatory limits need re-verification.** The PFAS NPDWR has been subject to
  ongoing reconsideration; see `limit_review` in `analytes.json`.
