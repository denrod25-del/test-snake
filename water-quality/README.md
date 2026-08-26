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
| Normalization core (units, analytes, schema) | Done, 196 tests passing |
| Source clients (SDWIS, UCMR 5, CCR, notices) | Done, exercised against a fake transport |
| Normalizers + ZIP index + profile assembly | Done |
| HTTP API + routing + CI ingest workflow | Done |
| Consumer page (`/water-quality.html`) | Done, browser-verified |
| ZIP / city / address → utility | Done, all three wired and tested |
| UCMR 5 PFAS ingest | Envirofacts, with a bulk-file fallback |
| CCR parsing | PDF + HTML paths proven against generated documents |
| Utility configs | 11 Florida systems, none resolved yet |
| Analyte dictionary (`/api/water/analytes`) | **Live now** — 81 analytes, committed |
| Utility lookup without an ingest | **Works** — falls back to a live EPA query |
| Sample results / PFAS | **Need the ingest** — see below |

**The upstream data has not been ingested yet.** The build environment this was
developed in blocks outbound access to `data.epa.gov`, `floridadep.gov`,
`prodenv.dep.state.fl.us`, and `echodata.epa.gov` at the network-policy layer
(HTTP 403 on CONNECT — see `data/water/source-probe.json`). GitHub Actions
runners are not subject to that policy, which is why the ingest runs there.

Until the first ingest completes the API does **not** simply fail. It degrades
in three tiers:

| Endpoint | Without an ingest |
|---|---|
| `/analytes` | Serves normally — the dictionary is committed, not upstream data |
| `/lookup`, `/system` | **Queries EPA live**, labelled `status: "live"` |
| `/systems` | 503 `coming-soon` — a whole-state inventory has no small live query |

The live fallback answers the question people actually arrive with — *which
utility serves me, and does it have violations* — from one small Envirofacts
query. What it deliberately does **not** do is fetch sample results. See
[the live fallback](#the-live-fallback).

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

Local dev server. `python -m http.server` cannot serve `/api/water/*`, so the
page's lookup and profile panels are untestable against it; this routes the API
through the real Netlify function handler:

```bash
node water-quality/devserver.mjs               # committed dataset
node water-quality/devserver.mjs --fixtures    # synthetic dataset, full page works
```

Then open <http://localhost:8765/water-quality.html>. With `--fixtures`, ZIP
**33410** returns two candidates, one with a PFOA exceedance and an incomplete
Hazard Index — the data is invented (fictional `FL999xxxx` utilities) and is for
development only.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/water/health` | dataset freshness, per-source status, record counts |
| `GET /api/water/analytes` | the analyte dictionary; `?group=pfas`, `?id=pfoa` |
| `GET /api/water/utilities` | utilities built out end to end |
| `GET /api/water/systems` | inventory; `?county=`, `?zip=`, `?type=`, `?q=`, `?limit=`, `?offset=` |
| `GET /api/water/system?pwsid=FL…` | one system's full profile |
| `GET /api/water/lookup?zip=33410` | ranked candidate utilities; `&city=` narrows |
| `GET /api/water/lookup?address=…` | geocodes the address, then ranks the same way |

All are public, CORS-open, GET-only, and rate-limited to 120 req/min per IP.
Every payload carries a `meta` block with a data-trust status matching
`assets/data-trust.js` (`live` / `cached` / `sample` / `blocked` / `broken` /
`coming-soon`).

## The page

`/water-quality.html` is the consumer front end: ZIP lookup, ranked utility
candidates, then a profile with summary tiles (exceedances, open health-based
violations, PFAS Hazard Index, active boil-water notices), a contaminant table
showing each result against its federal limit, and health-based violations.

Framing choices that are deliberate:

- It never says water is "safe" or "unsafe". It reports measurements against
  limits, with the sampling date and source on every row.
- Non-detects render as `< reporting limit`, never as `0`, with the note that
  this is not the same as zero and not a measurement of your tap.
- The lead row carries the caveat that lead is usually picked up from household
  plumbing *after* the water leaves the utility, so a clean system-level number
  does not rule it out at your tap.
- Contaminants with no federal limit are listed and labelled "Unregulated" —
  with the note that no limit means EPA has not set one, not that any amount is
  known to be safe.
- People on private wells are told none of it applies to them.

## The live fallback

`netlify/functions/_lib/envirofacts.js` queries EPA directly when `data/water/`
is unpopulated: service-area rows for one ZIP plus the matching inventory, or
one system plus its violations. Records come back in the same shape the ingested
dataset produces, and ranking runs through the same `rankCandidates` function, so
the two paths cannot drift and give different answers for the same ZIP.

**It refuses to fetch sample results, on purpose.** Results need unit conversion,
analyte-name resolution, and non-detect handling — the logic `fwq/` implements
carefully and covers with most of its tests. A second implementation in
JavaScript would drift from the first, and the drift would land in the
safety-critical direction: a mis-converted PFAS value, or a non-detect read as a
measurement. So a live profile returns violations and system details, an empty
`results` array, and a note saying exactly why.

The consumer page follows the same rule. With no results, the "over a federal
limit" tile shows an em dash and reads *"no sample results available — this is
not a clean result"*, in neutral grey. Showing a green zero there would tell
someone their water is fine on the strength of no data at all.

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

**PFAS has a fallback.** `envirofacts.fetch_ucmr5` probes candidate table names
because EPA has renamed the UCMR tables between cycles, and none is guaranteed to
answer. Since PFAS is the headline of this dataset, `fwq/sources/ucmr_bulk.py`
reads EPA's published bulk download instead — ZIP or delimited text, delimiter
sniffed, filtered to the state as rows stream past so the national file never
lands in memory. Bulk rows come out in the same shape Envirofacts produces, so
they run through the same normalizer with no special-casing, proven by a test
that asserts both paths yield identical records.

Point it at a downloaded file with `python -m fwq ingest --ucmr5-file ucmr5.zip`.
The manifest records which path the data actually came from.

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

`?address=` geocodes with the Census Bureau geocoder (free, no key) server-side
in the Netlify function, then falls back to ZIP+city matching and labels itself
`geocode+zip+city`. Real point-in-polygon resolution needs service-area geometry
from FDEP or utility GIS — tracked as `fdep-geodata` in `fwq/data/sources.json`
and not yet confirmed reachable.

Three failures the address path keeps separate, because conflating them sends
people to fix the wrong thing:

| What happened | Response |
|---|---|
| Geocoder unreachable | 200, "the geocoder could not be reached" — our problem |
| Address matches nothing | 200, "that address could not be geocoded" — check spelling |
| Address is outside Florida | 200, "outside this dataset's Florida coverage" |

None of them is a 500, and none is an empty list without an explanation.

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

## Configured utilities

Eleven Florida systems ship with configs: Seacoast, Palm Beach County WUD, West
Palm Beach, Boca Raton, Boynton Beach, Delray Beach, Jupiter, Miami-Dade WASD,
JEA, OUC, and Tampa. **None has a PWSID yet** — that is what `fwq resolve`
produces.

Only Seacoast carries candidate CCR and alerts URLs. For the rest no candidate
URL has been identified, and inventing ten of them would put ten dead links in
the API, so those arrays are empty until a real one is confirmed.

Some fragments are deliberately ambiguous and expected to resolve as `medium`
needing review — `TAMPA` will also match wholesale providers, `JUPITER` will
match systems in Martin County. The county and population expectations exist to
catch exactly that, and the lockfile records the rejected candidates.

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
  path work and are tested; per-utility scraping needs each alerts page
  confirmed individually. Add notices by hand in
  `fwq/data/manual_notices.json` during a live event.
- **CCR parsing has not seen a *real* utility document.** The PDF and HTML paths
  are now proven end to end against generated CCRs (`tests/test_ccr_document.py`),
  so the wiring is known good and a malformed or non-PDF payload degrades instead
  of aborting the ingest. But real CCRs use borderless tables, multi-column
  layouts, and footnote markers inside cells; the first real ones will still need
  iteration.
- **Regulatory limits need re-verification.** The PFAS NPDWR has been subject to
  ongoing reconsideration; see `limit_review` in `analytes.json`.
