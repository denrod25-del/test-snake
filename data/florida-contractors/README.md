# Florida Plumbing & HVAC Companies Spreadsheet

Generated: **2026-08-23 20:31:01** (UTC)

## What this is

A statewide company list of Florida **plumbing**, **HVAC / air conditioning**, and **mechanical** contractors assembled from the official Florida DBPR Construction Industry license extract (Current + Active only), with optional phone/website enrichment from `data/companies.json`.

| Metric | Count |
| --- | ---: |
| Total unique companies | 19532 |
| Corporate (PE / Public) | 20 |
| Franchise | 47 |
| Family-Owned (confirmed or name pattern) | 193 |
| Independent / Likely Family-Owned (unverified) | 19272 |
| Enriched from Google Maps scrape | 586 |

## Files

- `florida-plumbing-hvac-companies.xlsx` — Excel workbook with Summary + filtered sheets
- `florida-plumbing-hvac-companies.csv` — flat CSV of all companies
- `florida-plumbing-hvac-companies-corporate.csv`
- `florida-plumbing-hvac-companies-family.csv` — confirmed/pattern Family-Owned only
- `florida-plumbing-hvac-companies-independent.csv` — unverified independents (majority)

## Ownership honesty

Florida **does not publish** whether a contractor is family-owned or corporate-owned. Labels work like this:

1. **Corporate (PE / Public)** — matched to known roll-up / public brands (Wrench Group, Apex Service Partners, ARS/Rescue Rooter, Service Experts, Roto-Rooter/Chemed, etc.).
2. **Franchise** — matched to national franchise systems (Benjamin Franklin, One Hour, Mr. Rooter, Aire Serv, etc.).
3. **Family-Owned** — confirmed research (e.g. Peaden) or strong name cues (`& Sons`, `Family Owned`, `Brothers`).
4. **Independent / Likely Family-Owned (unverified)** — everyone else. Most Florida contractors fall here; treat as independent until verified.

## How to regenerate

```bash
# Download official extract (needs a normal browser User-Agent)
mkdir -p tmp-fl-contractors
curl -fsSL -A "Mozilla/5.0" \
  -H "Referer: https://www2.myfloridalicense.com/construction-industry/public-records/" \
  -o tmp-fl-contractors/CONSTRUCTIONLICENSE_1.csv \
  "https://www2.myfloridalicense.com/sto/file_download/extracts/CONSTRUCTIONLICENSE_1.csv"

python scripts/build_fl_plumbing_hvac_spreadsheet.py \
  --dbpr tmp-fl-contractors/CONSTRUCTIONLICENSE_1.csv \
  --companies data/companies.json \
  --out-dir data/florida-contractors
```

## License types included

- **CAC / RA** — Certified / Registered Air Conditioning
- **CFC / RF** — Certified / Registered Plumbing
- **CMC / RM** — Certified / Registered Mechanical

Status filter: primary status `C` (Current) + secondary status `A` (Active).
