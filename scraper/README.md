# Florida Tax Deed Registry — Scrapers

A small Python scraper suite that pulls public Florida county data into JSON files the website consumes. Currently:

- **Sales** — upcoming tax-deed auction dates (`scrape_sales.py` → `sales.json`)
- **Surplus** — surplus-funds resource pages (`scrape_surplus.py` → `surplus.json`)
- **Permits** — building permit records by parcel (`scrape_permits.py` → `data/permits/`)

## Architecture

```
scraper/
├── sources.json            sales: county -> auction-site mapping
├── sources_surplus.json    surplus: per-county overrides
├── sources_permits.json    permits: per-county portal mapping (67 counties)
├── manual_sales.json       sales: in-person counties + manual fallback
├── manual_surplus.json     surplus: manual entries
├── manual_permits.json     permits: manual entries (per-county arrays)
├── parsers.py              sales parsers (realauction, lienhub, deedauction)
├── parsers_surplus.py      surplus parsers
├── parsers_permits.py      permit parsers (pbc_edsweb, accela template)
├── scrape_sales.py         orchestrator: writes ../sales.json
├── scrape_surplus.py       orchestrator: writes ../surplus.json
├── scrape_permits.py       orchestrator: writes ../data/permits/*.json
└── requirements.txt        Python deps (shared)
```

The output `sales.json` is written to the repository root and looks like:

```json
{
  "generated": "2026-04-18T18:55:00Z",
  "stats":     { "scraped": 42, "manual": 4, "failed": 5 },
  "sales": {
    "Orange":     [{ "date": "2026-04-22", "count": 8 }, ...],
    "Miami-Dade": [{ "date": "2026-04-23", "count": 24 }, ...]
  }
}
```

`tax-deeds.html` fetches this on load, merges it into the inline `UPCOMING_SALES` defaults, and updates the topbar stamp to "Live data · updated 2 hours ago" when present.

## Running locally

```bash
cd scraper
pip install -r requirements.txt
python scrape_sales.py                 # full run
python scrape_sales.py --only Orange   # one county only (debug)
python scrape_sales.py --dry-run -v    # don't write file, print result
```

## Automated runs (GitHub Actions)

The workflow at `.github/workflows/scrape-sales.yml` runs every Monday at 06:30 UTC and commits any changes to `sales.json` back to the repo. You can also trigger it manually from the Actions tab.

To change the cadence, edit the cron line:

```yaml
schedule:
  - cron: '30 6 * * 1'   # weekly: Mondays 06:30 UTC
  # - cron: '0 8 * * *'  # daily:  08:00 UTC
  # - cron: '0 8 * * 1,4' # twice weekly: Mon & Thu
```

## Adding a new county

1. Open `sources.json` and add an entry:
   ```json
   "MyCounty": { "parser": "realauction", "url": "https://mycounty.realtaxdeed.com" }
   ```
2. Run `python scrape_sales.py --only MyCounty -v --dry-run` to verify the output.

## When a parser breaks

Auction platforms occasionally redesign their pages and existing selectors stop matching. When that happens:

1. Run the scraper for just the failing county with `-v --dry-run`.
2. Open the source URL in a browser and inspect the new markup.
3. Update the relevant function in `parsers.py` (`parse_realauction`, `parse_lienhub`, `parse_deedauction`).
4. Re-run the dry run until you get clean date entries.

The parsers are deliberately defensive: each tries multiple strategies (CSS selectors → text patterns → embedded JSON) before giving up. When all strategies fail it raises `NoDataError` and the scraper logs a `FAIL` line for that county but continues with the others.

## Manual overrides

For in-person-only counties (Baker, Bradford, Calhoun, etc.), add entries directly to `manual_sales.json`:

```json
{
  "Baker": [
    { "date": "2026-05-13", "count": 4, "opening": "courthouse steps, 11 AM" }
  ]
}
```

Manual entries are merged into the final `sales.json` after scraping. They win conflicts, so you can also use this file to correct a date the scraper got wrong.

## Honest caveats

- **Selectors will rot.** Vendors redesign sites every 6-18 months. Plan to spend ~30 min/quarter maintaining `parsers.py`.
- **Some sites are JS-rendered** and won't yield data with a plain `requests` fetch. For those, swap to Playwright (`pip install playwright && playwright install chromium`) and adapt `fetch()` in `scrape_sales.py`.
- **Be polite.** The scraper waits 1.5s between requests and uses a clear User-Agent. Don't crank these down — getting your IP banned by RealAuction would defeat the entire purpose.
- **The included sources.json URLs are pattern-matched** and may not all resolve correctly. Verify each URL the first time you onboard, especially for counties not on the standard `*.realtaxdeed.com` pattern.

---

# Permits Scraper (`scrape_permits.py`)

Pulls building-permit records from county portals and writes one JSON file per county to `../data/permits/`. The site loads `data/permits/index.json` on page load and lazy-loads each county file when a user opens that county's research entries.

## Output

```
data/permits/
├── index.json             coverage manifest (always written)
├── palm-beach.json        per-county permits, indexed by parcelId for O(1) lookup
├── orange.json
└── ...
```

Each county file has the shape:

```json
{
  "county":     "Palm Beach",
  "slug":       "palm-beach",
  "generated":  "2026-04-18T03:00:00Z",
  "source":     "https://epzb.pbcgov.org/eDSWeb/",
  "portalUrl":  "https://epzb.pbcgov.org/eDSWeb/",
  "scope":     "Building permits applied or issued in last 90 days",
  "permitCount": 142,
  "permitsByParcel": {
    "00434409010050010": [{ ...permit... }],
    "50434429050001234": [{ ...permit... }, { ...permit... }]
  }
}
```

Permit schema (see `data/permits/index.json` -> `schema.permit`):

```
permitNumber, parcelId, address, type, subtype, description, status,
applicantName, contractor, valuation, appliedDate, issuedDate,
finalDate, expirationDate, url
```

## Running the permit scraper

```bash
cd scraper
pip install -r requirements.txt

python scrape_permits.py                       # full run
python scrape_permits.py --only "Palm Beach"   # one county
python scrape_permits.py --dry-run -v          # don't write anything
python scrape_permits.py --skip-network        # only refresh manual + index
```

## Automated runs

`.github/workflows/scrape-permits.yml` runs daily at 07:30 UTC and commits any changes back to the repo. Trigger manually from the Actions tab to scope to specific counties.

## County coverage status

`sources_permits.json` declares all 67 FL counties with one of these statuses:

- **active** — live scraper (currently: Palm Beach via `pbc_edsweb`)
- **available** — public portal exists, scraper not yet built; the UI shows a "Lookup at portal →" link
- **manual** — no scraper, but `manual_permits.json` entries will be merged
- **unsupported** — no public portal; no automation possible

To upgrade an `available` county to `active`, write a new parser in `parsers_permits.py`, register it in `PERMIT_PARSERS`, then change that county's `parser` field in `sources_permits.json`. The orchestrator and UI auto-pick up the change.

## The Accela template (one parser → 25 counties)

About 25 FL counties use **Accela Citizen Access**: same software, slightly different subdomain. A single, parameterized `parse_accela()` parser will unlock all of them at once. The stub exists in `parsers_permits.py`. To implement:

1. Reverse-engineer one Accela permit search using browser DevTools (Hillsborough is well-documented).
2. Generalize the request payload — the only county-specific bits are the subdomain and the "module" parameter (`Building`, `Planning`, etc.).
3. Add the 25 Accela counties to `sources_permits.json` with `parser: "accela"`.

## Adding manual permit entries

Useful for filling gaps in `available` counties or seeding active ones for testing. Edit `manual_permits.json`:

```json
{
  "Broward": [
    {
      "permitNumber": "B-2025-XXXXXX",
      "parcelId": "00000000000000000",
      "address": "123 EXAMPLE ST, FT LAUDERDALE, FL 33301",
      "type": "Re-Roof",
      "status": "Issued",
      "appliedDate": "2025-12-01",
      "url": "https://bcedp.broward.org/..."
    }
  ]
}
```

Manual entries are merged with scraped data per county; manual wins when `permitNumber` collides.

## Palm Beach (`pbc_edsweb`) — first-run verification

eDSWeb is an ASP.NET WebForms app. The form-field names (`ctl00$ContentPlaceHolder1$txtAppliedDateFrom`, etc.) are deployment-specific and **must be verified the first time you run the scraper**:

1. Open `https://epzb.pbcgov.org/eDSWeb/PermitSearch.aspx` in a browser
2. Open DevTools → Network tab
3. Submit a date-range search
4. Inspect the POST payload; copy any field names that differ from `PBC_FORM_FIELDS` in `parsers_permits.py`

If the parser raises `NoPermitDataError` on first run, the error message will tell you exactly which assumption broke. Fixing it is usually a 5-line change.

## Honest caveats — permits

- **Permit portals are even more fragile than auction portals.** Counties redesign every 12-18 months and rarely warn anyone.
- **Many counties block scrapers.** The included delays (2.5s between counties) are a starting point; if you see rate-limit errors, increase `DELAY_BETWEEN_COUNTIES` in `scrape_permits.py`.
- **The `available` list reflects portals that *exist*, not ones we've successfully scraped.** Phase 2 work is filling in real parsers; until then the UI will show portal links so users can do the manual lookup.
- **Don't be the reason a county takes their portal offline.** Polite scraping is in everyone's interest.

---

# County SEO pages (`scripts/build_county_pages.py`)

Generates one static HTML page per Florida county at `counties/<slug>.html` plus a region-grouped landing at `counties/index.html` and a `sitemap.xml` at the project root. These are pure static pages with no JavaScript dependencies — search engines can index them, and they cross-link back into the live `tax-deeds.html` registry and `parcel-lookup.html` for users who land via search.

Each page pulls from:

- `sales.json` — upcoming tax-deed sale dates
- `surplus.json` — surplus-funds resources (if county publishes them)
- `data/permits/index.json` — permit-coverage status (active / stale / manual / portal-only / unsupported)
- `data/county-regions.json` — region grouping + cities-per-county
- `scraper/sources.json` and `scraper/sources_permits.json` — auction-platform and permit-portal URLs

## Running it

```
python scripts/build_county_pages.py
python scripts/build_county_pages.py --base-url https://yoursite.com
python scripts/build_county_pages.py --only "Palm Beach,Orange"      # debug
python scripts/build_county_pages.py --no-sitemap
```

Run **after each scrape** so the static pages stay current with the latest sale dates and permit coverage. The script is idempotent and fast (~1 second for all 67 counties + sitemap).

## Output

```
counties/
  index.html          ← region-grouped landing
  alachua.html
  baker.html
  ...
  palm-beach.html
sitemap.xml           ← all 67 counties + the 4 main pages
```

Each page contains:

1. **Stat grid** — region, next sale, permit coverage badge, surplus status
2. **Upcoming tax-deed sales** table (next 12 dates)
3. **Building permits** section with portal link
4. **Surplus funds** section (if county publishes resources)
5. **Cities and municipalities** list (3-column)
6. **How tax-deed sales work** generic explainer
7. **CTA** linking to the live registry view for that county
8. **Schema.org JSON-LD** for `Article` + `Event` (for rich-result eligibility)

## Honest caveats — SEO pages

- **No magic.** Static HTML pages don't outrank well-established sites overnight. They give Google something to index and create durable URLs that won't break when the SPA changes.
- **Re-run after scrapes.** The county pages are baked at build time — they don't auto-update when `sales.json` changes. Add the build to your scrape workflow if you want fresh content daily.
- **Set `--base-url` in production.** Without it, the canonical URLs and sitemap entries are relative, which hurts SEO. In CI/CD: `python scripts/build_county_pages.py --base-url ${{ secrets.SITE_BASE_URL }}`.
