# Florida Plumbing Directory — Data Ingestion

A zero-dependency Node script that calls the **Google Places API (New)** to discover every plumbing business with an online presence in Florida and writes them to `../data/companies.json`. The website (`plumbing-reviews.html`) loads that file automatically.

## Prerequisites

- **Node 20+** (uses built-in `fetch` — no `npm install` needed)
- A **Google Cloud project** with billing enabled
- The **Places API (New)** enabled on that project
- A Google API key restricted to that API

## Setup

1. **Get an API key**
   - Go to [console.cloud.google.com](https://console.cloud.google.com/)
   - Create or select a project
   - APIs & Services → Library → enable **"Places API (New)"** *(not the legacy Places API)*
   - APIs & Services → Credentials → Create credentials → API key
   - Edit the key → restrict to **Places API (New)** only (defense against accidental leaks)
   - Set up a **daily budget alert** in Billing — recommended cap: $20/day

2. **Set the key as an env var**

   PowerShell (current session only):
   ```powershell
   $env:GOOGLE_API_KEY="paste_your_key_here"
   ```

   Or copy `.env.example` to `.env` and load it however you prefer.

## Usage

All commands run from the `scripts/` directory.

```powershell
# Cost estimate without spending anything
node ingest.mjs --dry-run

# Run full ingest (all 120 cities)
node ingest.mjs

# Test run with just 5 cities first (recommended on first try)
node ingest.mjs --limit 5

# Resume after an error or interruption
node ingest.mjs --resume

# Wipe the cache and start fresh
npm run clean
```

## What it does

```
1. Reads data/fl-cities.json (~120 Florida cities)
2. For each city: queries Places "plumber in {city}, Florida"
   - Paginates up to 60 results per city
   - Caches every place_id to avoid duplicates across cities
3. For each unique business: fetches full Place Details
   - Name, address, phone, website, rating, review count
   - Up to 5 most-relevant reviews with author + date + text
4. Transforms into the schema the website expects
5. Writes data/companies.json
```

The script saves progress to `data/.ingest-cache.json` after every city and every 25 detail calls, so a crash or `Ctrl+C` is recoverable with `--resume`. The cache file is **not** the final output — keep it for resumption, delete it before a fresh full re-ingest.

## Cost expectations

Pricing as of 2025 (Google Places API New, "Pro" tier):

| Call type        | Cost per 1,000 | Per call  |
|------------------|----------------|-----------|
| Text Search      | $32.00         | $0.032    |
| Place Details    | $25.00         | $0.025    |

**Full statewide first run, rough estimate:**

- 120 cities × ~3 page calls = **~360 search calls** ≈ **$11.50**
- ~3,000 unique plumbers × 1 detail call = **~3,000 detail calls** ≈ **$75.00**
- **Total first run: ~$85**

Google currently includes a **$200/month free credit** on the Maps Platform, so the first ingestion is typically **$0 out of pocket**. Subsequent monthly refreshes hit the same number.

To reduce cost:
- `--limit 30` to cover only the 30 largest cities (~$25)
- Run quarterly instead of monthly
- Delete `.ingest-cache.json` only when you really need fresh data; otherwise rerun preserves everything

## Adding other platforms

The script currently only ingests **Google**. To add Yelp, BBB, or Facebook:

| Platform  | Method                                             | Key needed                    |
|-----------|----------------------------------------------------|-------------------------------|
| Yelp      | [Yelp Fusion API](https://www.yelp.com/developers) — `businesses/search` then match by name+address | Free key, 5000 calls/day |
| BBB       | No API. Either manual data entry or careful scraping with consent | None |
| Facebook  | [Meta Graph API](https://developers.facebook.com/docs/graph-api/) — only works on pages **you administer** | Page admin access token |

In `transformPlace()` look for `platforms: { google: { ... } }` — that's where additional platform objects get added. The website handles missing platforms gracefully.

## Output schema

`data/companies.json`:

```json
{
  "generated": "2026-04-18T21:30:00.000Z",
  "source": "Google Places API (New)",
  "count": 2847,
  "cities_queried": 120,
  "api_calls": { "searches": 358, "details": 2847 },
  "companies": [
    {
      "id": "abc-plumbing-inc-x7y8z9",
      "name": "ABC Plumbing Inc",
      "city": "Miami",
      "county": "Miami-Dade",
      "region": "Southeast",
      "address": "...",
      "phone": "(305) 555-...",
      "website": "abcplumbing.example",
      "founded": null,
      "services": ["Plumbing Service"],
      "platforms": {
        "google": { "rating": 4.7, "reviews": 1842 }
      },
      "lowStarPct": 0.04,
      "responseRate": 0.0,
      "praise": [],
      "complaints": [],
      "reviews": [ /* up to 5 */ ],
      "_googlePlaceId": "...",
      "_businessStatus": "OPERATIONAL"
    }
  ]
}
```

## Legal & ToS notes

- Google's terms allow displaying ratings + up to 5 reviews per business. Don't store/cache reviews longer than 30 days for production.
- Always show attribution: "Powered by Google" on pages that display Places data. The website includes this in its data-source banner already.
- Letter grades shown in the UI are an editorial composite — make sure your privacy / terms pages are clear that they're not endorsed by Google.
