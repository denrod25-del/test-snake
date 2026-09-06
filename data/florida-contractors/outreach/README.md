# Outreach lead lists (Family / Independent)

Generated: **2026-09-06 08:30** UTC

Corporate and franchise brands are **excluded**. These lists are for pitching local shops.

## Start here

1. Open **`outreach-board.html`** in your browser (double-click).
2. Filter to **Palm Beach** / **Broward** / etc.
3. Click **Copy SMS** and call/text the phone number shown.

## Files

| File | Use |
| --- | --- |
| `call-ready-priority-counties.csv` | Best dial list (phone + priority counties) — **599** leads |
| `call-ready.csv` | All FL family/independent with a phone — **888** |
| `research-queue.csv` | Priority-county shops still needing a phone lookup — **11411** |
| `outreach-board.html` | Click-to-copy SMS/email board |
| `plumbing-leads-import.json` | Import into the `plumbing-leads` app |

## Priority counties

Palm Beach, Broward, Miami-Dade, Martin, St. Lucie, Lee, Collier, Hillsborough, Pinellas, Orange, Duval, Sarasota, Manatee, Pasco

## Tier key

- **A** — Family-owned + phone + priority county (call first)
- **B** — Independent + phone + priority county
- **C** — Has phone, other Florida county
- **D** — Priority county, no phone yet (research)

## Import into plumbing-leads

```bash
cd plumbing-leads
python -c "import sys; sys.path.insert(0,'..'); ..."
# or:
python ../scripts/build_outreach_leads.py --import-plumbing-leads leads.db
python main.py
# open http://127.0.0.1:8000
```

## Honesty

Phones/websites come from matching `data/companies.json` (Google Maps scrape) onto DBPR license names. Matches are exact-name or high-confidence fuzzy with same city/county. Unmatched priority-county shops are in `research-queue.csv`.
