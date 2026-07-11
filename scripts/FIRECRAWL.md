# Firecrawl setup for the Florida Plumbing Review Index

[Firecrawl](https://github.com/firecrawl/firecrawl) scrapes websites into clean markdown / structured JSON. We use it to:

1. **Link cities** for “City TBD” companies (scrape their websites)
2. **Enrich reviews** (pull recent review text + praise/complaint themes from Google Maps / search)

The repo is already cloned at `../firecrawl/` (gitignored — it’s its own project).

---

## Option A — Cloud API (recommended to start)

1. Create a free account: https://www.firecrawl.dev/app/api-keys  
2. Copy your key (`fc-...`)
3. In PowerShell:

```powershell
$env:FIRECRAWL_API_KEY="fc-your-key-here"
```

4. Dry-run (no credits spent):

```powershell
node scripts/enrich-cities.mjs --dry-run
node scripts/enrich-reviews.mjs --dry-run
```

5. Test with 5 companies first:

```powershell
node scripts/enrich-cities.mjs --limit 5
node scripts/enrich-reviews.mjs --limit 5 --min-reviews 100
```

6. Full runs (resumable if interrupted):

```powershell
node scripts/enrich-cities.mjs --resume
node scripts/enrich-reviews.mjs --resume --min-reviews 50
```

Then refresh http://localhost:8765/plumbing-reviews.html

### Cost notes (cloud)

- JSON extract mode costs more credits than plain markdown scrape
- Review enrichment uses `proxy: enhanced` for Google Maps (extra credits)
- Start with `--limit 5` so you can see quality before burning the free tier

---

## Option B — Self-host (Docker)

You already have Docker. From the repo root:

```powershell
cd firecrawl
# Create .env from SELF_HOST.md template (PORT=3002, USE_DB_AUTHENTICATION=false)
# Optional: set OPENAI_API_KEY if you want JSON extract mode locally
docker compose up -d
```

Point our scripts at your local API:

```powershell
$env:FIRECRAWL_API_URL="http://localhost:3002"
# key optional when USE_DB_AUTHENTICATION=false
node scripts/enrich-cities.mjs --limit 3
```

### Self-host caveats

- No Fire-engine → Google Maps / anti-bot sites fail more often
- JSON extract needs an `OPENAI_API_KEY` (or Ollama) in `firecrawl/.env`
- See `firecrawl/SELF_HOST.md` for full env template

---

## Scripts

| Script | Job |
|--------|-----|
| `enrich-cities.mjs` | Fill city/address/phone from company websites |
| `enrich-reviews.mjs` | Pull review snippets + themes from Google Maps URLs |
| `lib/firecrawl.mjs` | Shared scrape/search helpers |
| `apify-to-companies.mjs` | Rebuild base list from Apify scrape |

Caches (safe to delete to force re-scrape):

- `data/.enrich-cities-cache.json`
- `data/.enrich-reviews-cache.json`

---

## Suggested order

1. `enrich-cities.mjs` — clean up the 176 City TBD rows  
2. `enrich-reviews.mjs --min-reviews 100` — enrich high-volume companies first  
3. Lower `--min-reviews` and widen coverage as credits allow  
