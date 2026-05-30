# Palm Beach County Parcel → Address Lookup

A single-file static web app that converts **PCNs**, **legal descriptions**, **owner names**, **subdivision names**, or **partial PCN prefixes** into property addresses for Palm Beach County, Florida.

> **Looking for the permit search?** See `permit-search.html` — keyword search of cached PBC permits for water filtration, water heaters, and all plumbing trades. Reads `data/permits/palm-beach.json` produced by `scraper/scrape_permits.py`. See [Permit Search](#permit-search) below.

Live data from the [Palm Beach County GIS Open Data](https://opendata2-pbcgov.opendata.arcgis.com/) public ArcGIS FeatureServer — no API key required.

## Features

- **Single lookup** by:
  - Full PCN / Parcel Number (exact)
  - PCN prefix (e.g. enter the first 12 digits to find every parcel in a given section)
  - Legal description text
  - Owner name (fuzzy / order-independent token matching with similarity ranking)
  - Subdivision name
  - Site address
- **Advanced filters** that AND with any search (or work alone): municipality, property use, year built range, acreage range, sale date range, sale price range, total market value range, homestead Y/N
- **Bulk lookup** — drag-and-drop CSV (first column = PCNs) or paste up to 500 PCNs. Runs 4 parallel batched queries for fast turnaround.
- **Per-row "Details & map" panel** — Leaflet map with the actual parcel polygon outlined on aerial imagery (toggle to OSM streets), plus full property details (sale date/price, market/assessed/taxable values, year built, homestead, etc.)
- **"Map all results" view** — see every result polygon at once, click any polygon to jump to its row in the table
- **Shareable URLs** — every search updates the URL, so you can bookmark, share, or refresh without losing state
- **Export results** to CSV (now includes valuation, sale, homestead, and lat/lon columns)
- **Google Maps + OpenStreetMap deep links** + click-to-copy PCN/address/coords
- Mobile-responsive dark-themed UI
- Zero build step — just static HTML/CSS/JS plus one CDN dependency (Leaflet, ~40 KB gz)

## Quick start (local)

Just open `parcel-lookup.html` in any modern browser — that's it.

Or serve the folder with any static server:

```bash
# Python
python -m http.server 8000

# Node
npx serve

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000/parcel-lookup.html`.

## Deploy

The whole app is one HTML file. Drop it on any static host.

### Option A — GitHub Pages (free, easiest)

1. Push this folder to a GitHub repo.
2. In **Settings → Pages**, set the source to your branch (e.g. `main`) and folder `/ (root)`.
3. Wait ~1 minute. Your app will be live at `https://<user>.github.io/<repo>/parcel-lookup.html`.
4. (Optional) To make it the homepage, either rename `parcel-lookup.html` to `index.html` or update `index.html` to redirect.

The included `.nojekyll` file disables Jekyll processing so files starting with `_` are served as-is.

### Option B — Netlify (free, drag-and-drop)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag this folder into the page.
3. Done. You'll get a URL like `https://<random>.netlify.app/parcel-lookup.html`.

For a custom domain or git-connected deploys, the included `netlify.toml` sets sensible defaults.

### Option C — Cloudflare Pages (free)

1. Push to GitHub/GitLab.
2. In the Cloudflare dashboard → **Pages → Create a project → Connect to Git**.
3. Build command: *(leave empty)*. Output directory: `/`.
4. Deploy.

### Option D — Vercel (free)

1. Install the CLI: `npm i -g vercel`
2. From this folder: `vercel`
3. Accept defaults. Done.

Or push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new). The included `vercel.json` is empty/minimal — no config needed for a static site.

### Option E — Anywhere else

Any static host works (S3 + CloudFront, Firebase Hosting, Surge, Render, GitLab Pages, etc.). Just upload `parcel-lookup.html`.

## Making it the default page

If you only want to deploy the parcel-lookup app (not the snake game files in this folder), you have two options:

**Option 1 — Copy just the one file** to a fresh directory, then rename it to `index.html`:

```bash
mkdir parcel-app && cp parcel-lookup.html parcel-app/index.html
# Deploy parcel-app/ instead of the whole folder
```

**Option 2 — Replace the homepage in this folder.** Back up the snake `index.html`, then:

```bash
mv index.html snake-index.html
cp parcel-lookup.html index.html
```

## Data source & notes

- **Endpoint:** `services1.arcgis.com/.../CollectionDays_Parcels/FeatureServer/21`
- **Coverage:** ~659,000 parcels across Palm Beach County, FL
- **Refresh cadence:** monthly (driven by the County's open data publishing schedule)
- **Authoritative source:** [Palm Beach County Property Appraiser](https://pbcpao.gov/)
- **Address type:** *situs* (location) addresses as recorded by the County. Some parcels (vacant land, easements, condo airspace, etc.) legitimately have no situs address — those rows show `—`.
- **PCN format:** 17 digits, no dashes. The app strips non-digits automatically, so input like `00-43-41-32-14-000-2130` works fine.

## Privacy / cost

- All queries go directly from the user's browser to Palm Beach County's public ArcGIS service. No backend, no analytics, no tracking.
- Leaflet (the mapping library) is loaded from `unpkg.com` via the CDN. If your environment blocks third-party CDNs, download `leaflet.js` and `leaflet.css` and self-host — adjust the two `<link>`/`<script>` URLs in the `<head>`.
- Map tiles come from `tile.openstreetmap.org` (free, no key) and `server.arcgisonline.com` for the optional aerial layer (also free, no key, public Esri imagery).
- No API keys are baked into the HTML — there are none to leak.

## Shareable URLs

Each search (single or bulk) and every active filter is reflected in the URL query string, so you can:

- Bookmark a complex filtered view
- Share a result with a colleague (`?mode=pcn&q=00434132140002130`)
- Pre-fill the page with filters baked into a link (`?pu=SINGLE%20FAMILY&yb_min=2010&sp_min=500000`)
- Hit refresh without losing what you were looking at

URL parameters used:
- `tab=single|bulk`
- `mode=pcn|pcn-prefix|legal|owner|subdiv|address`
- `q=<query>`
- `bulk=<comma-separated PCNs>` (bulk mode)
- Filter params: `mu`, `pu`, `yb_min`, `yb_max`, `ac_min`, `ac_max`, `sd_min`, `sd_max`, `sp_min`, `sp_max`, `tm_min`, `tm_max`, `hs`

## Permit Search

`permit-search.html` is a sister single-file static page focused on Palm Beach County **building permits** instead of parcels. It searches a locally cached snapshot (`data/permits/palm-beach.json`) for keyword matches across the description, type, contractor, and address fields, then lets you filter by date, status, contractor, city, and valuation.

### Why it works this way

PBC's free public permit lookup (eDSWeb) **does not** support keyword search of "scope of work" text. It only searches by permit number, address, owner, or contractor. The formal "Open Permit Search" service costs $63 per query and takes 7–10 days. So this tool takes a different approach:

1. The Python scraper in `scraper/` pulls 90 days of PBC permits from `epzb.pbcgov.org/eDSWeb/` and writes them to `data/permits/palm-beach.json`.
2. `permit-search.html` loads that JSON in the browser and runs all keyword filtering locally.
3. Results link back to the original permit on PBC's portal for verification.

### Features

- **Keyword presets**: water filtration, water heater, all plumbing, gas lines, sewer/drain, repipe — each adds 6–10 related terms (e.g. "softener", "RO", "tankless", "lateral", "backflow")
- **Custom keywords** via chip-style input, with ANY-vs-ALL matching mode
- **Filters**: applied/issued date range, status (multi-select), permit type (multi-select), city contains, contractor contains, min/max valuation
- **Sortable results table** with inline keyword highlighting and per-permit detail panel
- **Map view** (Leaflet + OpenStreetMap) with on-demand geocoding via Nominatim, cached in localStorage
- **Stats tab**: contractor leaderboard, status/type/city distributions, total value, active vs expired counts
- **CSV export** of filtered results
- **Manual upload tab**: paste JSON or drop a CSV to merge data from other sources (e.g. records-request results, other city portals)
- **Shareable URLs** — every keyword and filter is reflected in the query string
- **Honest data freshness banner** — yellow warning if cache is sample data, green if live, red if scraper hasn't run

### Refreshing the data

```bash
cd scraper
pip install -r requirements.txt
python scrape_permits.py --only "Palm Beach" -v
```

Then refresh `permit-search.html` in your browser. See `scraper/README.md` for parser maintenance notes (eDSWeb's WebForms field names occasionally change).

### Coverage caveats

- **Unincorporated PBC only.** Permits issued by individual cities (West Palm Beach, Boca Raton, Delray, Boynton, Royal Palm, Jupiter, etc.) are NOT in eDSWeb — each city runs its own portal on a different platform (Tyler Civic Access, Click2Gov, CivicPlus JCDS, etc.). To add a city, write a parser in `scraper/parsers_permits.py` and have it write to `data/permits/<city>.json`.
- **90-day lookback** by default. For older permits, file a [public records request](https://discover.pbc.gov/pzb/pages/records-request.aspx).
- **Permits are public records** under Florida Sunshine Law. The scraper rate-limits to 1 req/sec and identifies its User-Agent.

## License

The app code is provided as-is. The underlying parcel data is © Palm Beach County Property Appraiser and subject to their [terms of use](https://pbcpao.gov/).
