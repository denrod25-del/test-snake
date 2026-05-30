# PalmLeads — Plumbing Lead Generator

A small full-stack tool for generating, tracking, and pitching plumbing
businesses in **Palm Beach County, FL** (or anywhere) as part of a
lead-broker business.

You search Google's Places API for plumbers in a city, the matching
businesses save automatically to a local SQLite "pipeline", and you can
manage them through a status board (New → Contacted → Qualified → Closed),
add notes, scrape their website for emails / social handles / services,
and copy ready-to-send outreach templates pitched at the broker angle
("we send you ready-to-call homeowners — pay only for qualified leads").

## Stack

- **Backend:** Python 3.10+, FastAPI, SQLite, httpx, BeautifulSoup
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Data:** Google Places API (New) + Geocoding API

## Setup

### 1. Get a Google API key

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a project (or pick one), then **Create credentials → API key**
3. Enable these APIs in the same project:
   - [Places API (New)](https://console.cloud.google.com/apis/library/places.googleapis.com)
   - [Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)
4. Set up billing on the project (Google's $200/month free credit covers
   thousands of searches; you won't be charged unless you blow past it).

### 2. Install & configure

```bash
cd plumbing-leads
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env       # Windows
# cp .env.example .env       # macOS / Linux
```

Open `.env` and paste your `GOOGLE_API_KEY`. Optionally edit the
`BROKER_*` variables — these get baked into the outreach templates.

### 3. Run

```bash
python main.py
```

Then open <http://127.0.0.1:8000> in your browser.

## How to use

### Find Plumbers tab

1. Pick a city (e.g. `West Palm Beach, FL`, `Boca Raton, FL`,
   `Jupiter, FL`).
2. Set radius (1–31 miles). Google's Places API caps this at ~31 mi.
3. Click **Run Search & Save**.

Each search saves new businesses to your pipeline. Duplicates are
detected by Google's `place_id` and skipped automatically, so it's safe
to run the same search multiple times or run searches across different
cities.

To cover all of Palm Beach County, run searches centered on the major
cities and let the dedupe handle overlap:

- West Palm Beach, FL
- Boca Raton, FL
- Boynton Beach, FL
- Delray Beach, FL
- Jupiter, FL
- Wellington, FL
- Lake Worth, FL
- Royal Palm Beach, FL

### Lead Pipeline tab

- Click any row to open the **lead detail modal**.
- Set status, add notes, click **Enrich Website** to scrape emails /
  social / services from their site (best-effort).
- Copy outreach templates (SMS, email, voicemail, LinkedIn DM) — they
  auto-fill the lead's name, city, and rating.
- Filter by status, by "no website only" (great pitch hook), or sort by
  rating / reviews.
- **Export CSV** at any time.

## API endpoints

For your own automation:

| Method | Path | Description |
| --- | --- | --- |
| GET    | `/api/config`                 | Server config + broker info |
| POST   | `/api/search`                 | Run a Places search |
| GET    | `/api/leads`                  | List leads (filters: status, no_website_only, search, sort) |
| GET    | `/api/leads/{place_id}`       | Get one lead + outreach templates |
| PATCH  | `/api/leads/{place_id}`       | Update status / notes / phone / website |
| DELETE | `/api/leads/{place_id}`       | Delete |
| POST   | `/api/leads/{place_id}/enrich`| Scrape website |
| GET    | `/api/export.csv`             | CSV download |

## Notes & limits

- Google's Places **text search** caps at 60 results per query. The app
  pages through up to 3 pages. To get more for a wider area, run multiple
  city searches — duplicates are auto-removed.
- Website enrichment is best-effort. Some sites block scrapers, return
  JS-rendered shells, or hide emails behind contact forms. Treat what you
  get as a starting point.
- The API key lives **only on the server** — it never reaches the
  browser. Don't commit your `.env` file.
- This is a single-user local tool. For team use, swap SQLite for
  Postgres and add auth.

## Legal

Google's API terms allow this use case (you're using their official API,
not scraping google.com). However:

- Always honor robots.txt when enriching websites for real outreach.
- Outbound SMS to businesses must comply with TCPA — get consent or use
  the templates strictly for cold *email* / phone / LinkedIn until you've
  confirmed your local rules.
