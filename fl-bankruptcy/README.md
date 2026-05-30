# Florida Bankruptcy Tracker

A static, single-folder web app that displays bankruptcy filings across the three federal bankruptcy districts of Florida (Northern, Middle, Southern). It ships with a synthetic dataset so the UI works out of the box — replace `data/filings.json` with output from a real source whenever you're ready.

## What's included

| Page             | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `index.html`     | Dashboard — KPIs, 12-month trend, by-chapter / by-district charts, top counties (90 d), most-recent filings |
| `filings.html`   | Searchable & filterable table (debtor, district, chapter, status, date range, debtor type) + CSV export + pagination |
| `filing.html`    | Per-case detail page (case overview, scheduled assets / liabilities, illustrative docket timeline) |
| `about.html`     | Data sources, schema, legal notes, how to wire up live data    |

Architecture: plain HTML + CSS + vanilla JS. Tailwind is not used — a single hand-rolled `css/styles.css` provides the dark theme. [Chart.js](https://www.chartjs.org/) is loaded from a CDN for the dashboard charts. No build step, no `node_modules`.

## Quick start

```powershell
cd fl-bankruptcy
python -m http.server 8000
```

Open <http://localhost:8000>.

> Browsers block `fetch()` on `file://` URLs, so opening `index.html` directly will fail to load `data/filings.json`. Always go through a local server.

## Regenerating the demo data

```powershell
python scripts/generate_mock_data.py
```

This rewrites `data/filings.json` with 240 randomly generated filings, weighted by realistic district / chapter distributions. The seed is fixed (`random.seed(20260101)`) so the output is reproducible.

## Replacing demo data with real filings

The front-end only depends on the **shape** of `data/filings.json`. Any pipeline that produces JSON in this format will work:

```jsonc
{
  "generated_at": "2026-04-23",
  "source": "CourtListener RECAP",
  "districts": { "FLND": { ... }, "FLMB": { ... }, "FLSB": { ... } },
  "filings": [
    {
      "id":               "flbk-00001",
      "case_number":      "26-04001",
      "filed_date":       "2026-04-12",
      "chapter":          "7",
      "chapter_label":    "Chapter 7 — Liquidation",
      "district_code":    "FLMB",
      "district_name":    "Middle District of Florida",
      "district_short":   "M.D. Fla.",
      "division":         "Tampa",
      "county":           "Hillsborough",
      "judge":            "Hon. Catherine Peek McEwen",
      "debtor":           "Jane Doe",
      "debtor_type":      "Individual",
      "nature_of_debt":   "Consumer / Non-Business",
      "attorney":         "Stephanie Lieb",
      "total_assets":      42500,
      "total_liabilities": 118300,
      "status":           "Open"
    }
  ]
}
```

Recommended live sources:

- **[CourtListener / RECAP](https://www.courtlistener.com/recap/)** — free REST API; the practical default for a hobby project.
- **[PACER](https://pacer.uscourts.gov/)** — official, authoritative, $0.10/page (capped at $3/document).
- **Court RSS feeds** — each Florida bankruptcy court publishes a free 24-hour feed of new filings.
- **Commercial aggregators** (Epiq, Stretto, BankruptcyData) — paid but turnkey.

## Project layout

```
fl-bankruptcy/
├─ index.html              # dashboard
├─ filings.html            # searchable list
├─ filing.html             # detail (?id=flbk-00001)
├─ about.html
├─ css/
│   └─ styles.css          # dark theme, hand-rolled
├─ js/
│   └─ data.js             # data loader + utilities, injects nav/footer
├─ data/
│   └─ filings.json        # generated mock data (overwrite to use real data)
└─ scripts/
    └─ generate_mock_data.py
```

## Notes on bankruptcy data

- U.S. bankruptcy filings are public records by statute (11 U.S.C. § 107).
- Personally identifying information (full SSNs, full account numbers, minors' names, etc.) must be redacted under **Fed. R. Bankr. P. 9037** before publication.
- The synthetic data here is purely illustrative. Names, case numbers, and amounts are randomly generated and do not refer to any real person or business.
