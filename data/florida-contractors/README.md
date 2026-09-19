# Florida Plumbing & HVAC Companies Spreadsheet

Generated from the Florida DBPR Construction Industry license extract (Current + Active).

## Outreach lists (option A)

Ready-to-call family/independent shops (corporate/franchise excluded):

- Folder: [`outreach/`](outreach/)
- Start with **`outreach/outreach-board.html`** (browser) or **`outreach/call-ready-priority-counties.csv`**
- Import into PalmLeads: `python scripts/build_outreach_leads.py --import-plumbing-leads plumbing-leads/leads.db`

## How to open these files

**Do not open the `.xlsx` inside Cursor** — you’ll get “binary file not supported.”  
**Do not use `localhost` links from the cloud agent** — those only work on the remote machine, not your PC.

### Easiest (browser)

1. Download **`OPEN-IN-BROWSER-florida-plumbing-hvac.html`** from the agent Artifacts panel  
   **or** open this file from the repo:  
   `data/florida-contractors/florida-plumbing-hvac-companies.html`
2. Double-click it so it opens in Chrome / Edge / Safari.
3. Use the tabs: Corporate · Franchise · Family-Owned · Independents (sample).

GitHub (after the PR branch is available):  
https://github.com/denrod25-del/test-snake/blob/cursor/fl-plumbing-hvac-companies-spreadsheet-e512/data/florida-contractors/florida-plumbing-hvac-companies.html  
→ click **Raw**, then save the page, or use “Open in browser” if your GitHub UI offers it.

### Excel / Google Sheets

Download one of these CSVs and open in Excel, or in Google Sheets use **File → Import → Upload**:

| File | Contents |
| --- | --- |
| `florida-plumbing-hvac-companies-corporate.csv` | Corporate / PE / public brands |
| `florida-plumbing-hvac-companies-franchise.csv` | Franchise brands |
| `florida-plumbing-hvac-companies-family.csv` | Family-owned (confirmed / name pattern) |
| `florida-plumbing-hvac-companies.csv` | Full statewide list (~19.5k rows, ~8 MB) |
| `florida-plumbing-hvac-companies.xlsx` | Same data as Excel workbook (open in Excel, not Cursor) |

## Counts (approx.)

| Bucket | Count |
| --- | ---: |
| Total unique companies | 19,532 |
| Corporate (PE / Public) | ~20 |
| Franchise | ~47 |
| Family-Owned | ~193 |
| Independent / Likely Family-Owned (unverified) | ~19,272 |

## Ownership honesty

Florida **does not publish** family vs corporate ownership. Corporate/Franchise labels use confirmed brand maps. Everything else is independent/unverified unless a name cue matched.

## Regenerate

```bash
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
