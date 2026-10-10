# Outreach lead lists (Family / Independent)

## Start calling today

1. Download **`START-HERE-day1-dial-sheet.html`** from Artifacts (or open `DAY1-dial-sheet.html` here).
2. Double-click it → opens in your browser.
3. Tap each phone number to dial. Check **done** as you go.
4. Log results in **`START-HERE-call-tracker.csv`** (`interested` / `callback` / `not interested` / `no answer`).

**Goal:** 25–40 calls today.

Phones on the Day 1 sheet are filtered so the **area code matches the county** (wrong-market duplicates removed).

## Files

| File | Use |
| --- | --- |
| `DAY1-dial-sheet.html` | Call now — script + Copy SMS |
| `DAY1-dial-sheet.csv` | Same list in Excel/Sheets |
| `call-tracker.csv` | Log outcomes |
| `call-ready-verified-local.csv` | Broader verified dial list after Day 1 |
| `call-ready-priority-counties.csv` | All priority-county rows with a phone |
| `research-queue.csv` | Still need phone research |
| `outreach-board.html` | Larger board with filters |

## Import into plumbing-leads

```bash
python scripts/build_outreach_leads.py --import-plumbing-leads plumbing-leads/leads.db
cd plumbing-leads && python main.py
```
