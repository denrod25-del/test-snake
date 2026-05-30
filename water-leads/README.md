# AquaLeads — Water-Filtration Lead Generator

A local, single-user tool that pulls Palm Beach County, FL public water
system data from the **EPA Envirofacts SDWIS** REST API, flags systems
with active MCL / MRDL / TT violations and Lead & Copper Rule
exceedances, rolls those flags up into ZIP-level "target areas," and
generates homeowner-facing outreach copy (door hangers, postcards,
Facebook ads, Nextdoor posts, email) that quotes the public EPA record
so the claim is verifiable.

Every pitch in this app is grounded in a link back to
`enviro.epa.gov/envirofacts/sdwis/...` — that's the whole hook.

## Stack

- **Backend:** Python 3.10+, FastAPI, SQLite, httpx
- **Frontend:** vanilla HTML/CSS/JS + Leaflet (CDN) for the map tab
- **Data:**
  - EPA Envirofacts Data Service API (SDWIS) — no key required
  - EPA UCMR 5 occurrence data — manual upload of the national text file
  - US Census ACS 5-year API — optional, recommended free key
  - Zippopotam.us (primary) / Nominatim (fallback) for ZIP centroid geocoding

## Setup

```bash
cd water-leads
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env    # Windows
# cp .env.example .env    # macOS / Linux
```

Edit `.env` and set:

- `BRAND_*` — your company info, baked into outreach templates.
- `TARGET_COUNTY` / `TARGET_STATE` — defaults to `PALM BEACH` / `FL`.
- `CENSUS_API_KEY` — optional, get a free key at
  <https://api.census.gov/data/key_signup.html>. Without it, ACS income
  pulls still work but are rate-limited.
- `ENABLE_SCHEDULED_SYNC=1` + `SCHEDULE_INTERVAL_HOURS=168` — enable the
  weekly background refresh.
- `ALERT_WEBHOOK_URL` — optional, any URL that accepts a JSON POST. When
  a sync finds new health-based violations or new PFAS detections, the
  app will POST `{type, pwsid, zip, message, detected_at}`.

## Run

```bash
python main.py
```

Open <http://127.0.0.1:8000> (or whatever you set with `LISTEN_HOST` /
`LISTEN_PORT`).

### Daily use: local

- **Quick start (Windows):** `.\scripts\start-aqualeads.ps1` from the
  `water-leads` folder (expects `.venv` + `pip install -r requirements.txt`).
- **macOS / Linux:** `chmod +x scripts/start-aqualeads.sh` then
  `./scripts/start-aqualeads.sh`.
- **Manual:** activate the venv and run `python main.py`.

Environment (in `.env`):

| Variable | Purpose |
| --- | --- |
| `LISTEN_HOST` | Default `127.0.0.1` (only this machine). Use `0.0.0.0` to accept connections from your LAN (then use your PC’s LAN IP from a phone or another computer). |
| `LISTEN_PORT` | Default `8000`. |
| `AQUA_LEADS_RELOAD` | Default `1` (auto-reload on code edits). Set `0` for a stable process with no file watching. |
| `AQUA_LEADS_BASICAUTH_USER` / `AQUA_LEADS_BASICAUTH_PASS` | Optional. If **both** are set, the browser asks for a password before the UI loads. Use when the app is reachable from outside your own account. Always prefer **HTTPS** in front of Basic auth on the public internet. |
| `DATABASE_PATH` | Where SQLite lives; default `water-leads.db` in the project folder. |
| `ENABLE_SCHEDULED_SYNC` / `SCHEDULE_INTERVAL_HOURS` | Background EPA refresh; leave on for a daily “always fresh” instance. |

**Back up your data** — the CRM state and all ingested data are in the
SQLite file. On Windows, `.\scripts\backup-db.ps1` copies the DB to
`backups/` with a timestamp. For Docker, the DB is under `data/`
(see below).

`GET /api/health` always returns 200 when the database opens (and does
**not** use Basic auth), so you can use it for Docker health checks or
uptime monitoring.

### Daily use: remote (pick one)

1. **Private network (simplest).** [Tailscale](https://tailscale.com/)
   or another mesh VPN: install on your work PC and your laptop/phone;
   run AquaLeads on the PC with `LISTEN_HOST=127.0.0.1` and open
   `http://100.x.x.x:8000` from the other device **without** opening your
   home router. No app changes required.
2. **Raw LAN.** Set `LISTEN_HOST=0.0.0.0`, find your PC’s IP (e.g.
   `ipconfig` / `ip addr`), open `http://192.168.x.x:8000` on another
   device on the same Wi-Fi. **Firewall:** allow the chosen TCP port
   for private networks only.
3. **HTTPS tunnel (quick remote URL).** Run the app on localhost, then
   use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) (`cloudflared tunnel --url http://127.0.0.1:8000`) or
   a similar product so you get a public URL. **Set Basic auth** in
   `.env` when using any public URL.
4. **Docker (always-on server or NAS).** From `water-leads/`:

   ```bash
   mkdir -p data
   docker compose up -d --build
   ```

   Copy `.env` from `.env.example` and configure; the database is
   `data/water-leads.db` on the host. The compose file sets
   `AQUA_LEADS_RELOAD=0` and maps port `8000` by default.

## How to use

1. Click **↻ Refresh from EPA** in the top-right. This takes 20–90 seconds
   for a full county — it pulls `GEOGRAPHIC_AREA`, `WATER_SYSTEM`,
   `VIOLATION`, and `LCR_SAMPLE_RESULT` rows, normalizes them into
   SQLite, then rebuilds the per-ZIP risk scores.
2. **Water systems** tab — raw list of every PWS with service in your
   county. Filter "flagged only" to jump to systems with active MCL,
   TT, or lead/copper issues. Click a row to open full detail in a new
   tab, including a direct link to the EPA record for verification.
3. **Target ZIPs** tab — ZIPs ranked by `risk_score` *or* by
   `opportunity_score` (risk × median household income). This is where
   the sales workflow lives. Flags surface **PFAS** detections and
   **lead-risk tier** (high/medium/low) derived from LCR + housing age.
   Clicking a ZIP jumps you to:
4. **Pipeline** tab — CRM-style management. Set status
   (`new → researching → campaign_live → converted`), add notes, copy
   any of the outreach templates, and **Export CSV**. The detail view
   shows ACS demographics, full PFAS results by analyte, and any LSL
   inventory you've uploaded.

   When a ZIP is served by multiple utilities with materially different
   risk profiles (e.g. 33414, where Wellington WTP has no PFAS on record
   but Seminole Improvement District is 2.8× over the PFOS MCL), the
   outreach panel splits into **sub-area tabs** — one per risk signature.
   Each tab cites the specific utility, specific analyte, specific
   sample measurement, and specific EPA URL for that sub-area. Running
   one "PFAS above MCL!" ad across the whole ZIP would embarrass you
   when a Wellington homeowner looks up their utility and finds no PFAS.
5. **Map** tab — Leaflet view of every ranked ZIP, sized by population
   and colored by risk. Centroids are geocoded on first view and cached.
6. **Alerts** (bell icon, top-right) — every sync diffs new health-based
   violations and new PFAS detections against the previous snapshot and
   logs them here. Optionally POSTs each alert to `ALERT_WEBHOOK_URL`.

### Optional data uploads

- **UCMR 5 PFAS** — EPA does not expose UCMR 5 via the Envirofacts REST
  API. Download `UCMR5_All.txt` (pipe-delimited) from the
  [EPA UCMR data page](https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule),
  then use the **Import UCMR 5** button on the Target ZIPs toolbar. The
  ingester matches rows by PWSID, so any detections for systems in your
  configured county will surface on system and ZIP detail views.
- **LSL inventory** — `POST /api/lsl/import` accepts a CSV with columns
  `pwsid,zip,lead,galvanized,unknown,total` to overlay utility-reported
  lead service line counts on top of the housing-age heuristic.

## EPA endpoints used

All requests hit `https://data.epa.gov/efservice/{TABLE}/{col}/{op}/{val}/.../ROWS/{a}:{b}/JSON`.

| Table | How we filter | What we use it for |
| --- | --- | --- |
| `GEOGRAPHIC_AREA` | `state_served` + `county_served` | Get every PWSID serving the target county, plus its `zip_code_served` / `city_served` rows |
| `WATER_SYSTEM` | `pwsid` in (...) | Inventory: name, type, population, admin contact |
| `VIOLATION` | `pwsid` in (...) | Active MCL/MRDL/TT violations + contaminant codes |
| `LCR_SAMPLE_RESULT` | `pwsid` in (...) | 90th-percentile lead/copper sample results |

The Envirofacts API is keyless. See
<https://www.epa.gov/enviro/envirofacts-data-service-api>.

## Risk scoring

Per system (`scoring.py::score_system`):

- +3 any active health-based MCL or MRDL violation
- +3 Lead & Copper Rule **lead** exceedance (≥ 15 µg/L)
- +3 PFAS detection above the UCMR 5 reference level for any analyte
- +2 PFAS detected below MCL (any UCMR 5 hit)
- +2 LCR **copper** exceedance (≥ 1.3 mg/L)
- +2 any active treatment-technique (TT) violation
- +1 per additional open violation, capped at +3
- +1 if system serves > 10,000 people; +1 more if > 100,000

**Lead-risk tier** (per system, surfaced to ZIPs by max):
- `high` — LCR lead exceedance, *or* active lead/copper violation, *or*
  > 60% housing built pre-1980 (from ACS).
- `medium` — measurable lead in LCR samples *or* > 30% pre-1980 housing.
- `low` — otherwise.

Per ZIP:

- Sum of system scores (de-duped per-system in that ZIP)
- Weighted by `log10(population_impacted + 10)` so large utilities
  rise to the top without completely dominating small high-lead systems.
- **Opportunity score** = `risk_score × income_factor`, where
  `income_factor` linearly interpolates between 0.6 (HHI $30k) and 1.4
  (HHI $150k+). This surfaces ZIPs that both have a real problem *and*
  can afford a $1–3k filtration system.

## B2C targeting approach

This tool only works at **ZIP / city granularity**. We do not scrape
homeowners, purchase consumer lists, or integrate voter / property
records. The advertised channels are all one-to-many neighborhood
channels:

- Door hangers and direct-mail postcards (drop in flagged ZIPs)
- Facebook / Instagram geo-ads targeting the ZIP radius
- Nextdoor posts to the specific neighborhood
- Warm email only if you have an existing relationship

## Legal / compliance notes

- **EPA data is public.** Pulling from Envirofacts is explicitly
  encouraged by EPA, no API key required. Please cache and avoid
  re-syncing more than once a day.
- **Don't cold-SMS.** TCPA damages are $500–$1500 per unsolicited
  message. The templates include no SMS — that's deliberate.
- **CAN-SPAM.** Any email blast must include a physical address and an
  unsubscribe link. Templates here are *copy to clipboard only*; the
  app never sends for you.
- **Claims.** Always cite the Envirofacts URL. Don't editorialize EPA
  data; the point of this tool is that you're surfacing a public record,
  not making a new allegation.
- **NSF certifications.** If you pitch a filter as removing a specific
  contaminant, make sure the product is **NSF/ANSI certified** for that
  contaminant (e.g. NSF/ANSI 53 for lead). Misrepresenting this is
  actionable.

## API reference

| Method | Path | Description |
| --- | --- | --- |
| GET  | `/api/health` | Liveness + DB check; always unauthenticated (no Basic auth) |
| GET  | `/api/config` | Target county, brand info, last sync, stats, `basic_auth_enabled` |
| POST | `/api/sync` | Full refresh from EPA for the configured county |
| GET  | `/api/systems` | List water systems (filters: `flagged_only`, `issue_type`, `min_pop`, `search`) |
| GET  | `/api/systems/{pwsid}` | System detail + violations + LCR + service areas |
| GET  | `/api/zips` | Ranked ZIP targets (filters: `status`, `flagged_only`, `search`, `sort`) |
| GET  | `/api/zips/{zip}` | ZIP detail + systems + templates |
| PATCH | `/api/zips/{zip}` | Update `status` / `notes` |
| GET  | `/api/zips/{zip}/templates` | Re-render templates only |
| GET  | `/api/export.csv` | CSV of ranked ZIP targets |
| GET  | `/api/map` | ZIP centroids + risk for the Leaflet view (geocodes lazily) |
| GET  | `/api/alerts` | Recent new-violation / new-PFAS alerts |
| POST | `/api/alerts/mark-read` | Mark alerts seen |
| POST | `/api/ucmr/import` | Upload `UCMR5_All.txt` for PFAS occurrence |
| POST | `/api/lsl/import`  | Upload lead service line inventory CSV |

## Out of scope (v1)

- No automated email / SMS sending. Copy-to-clipboard only.
- No auth — single-user local tool. For team use, swap SQLite for
  Postgres and add auth.
- Florida DEP state-primacy data (some violations are reported to DEP
  before they roll up to EPA). Can be layered in by adding a second
  client for `floridadep.gov` open data.
