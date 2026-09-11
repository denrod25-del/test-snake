# DeedScout share kit + brand profiles

## Brand profiles (do this once)

Claim these handles if free, then reply with the live URLs so we can fill homepage `sameAs`:

| Platform | Suggested handle | Profile URL (paste when live) |
|---|---|---|
| LinkedIn company | DeedScout | |
| X / Twitter | @deedscout | |
| Facebook page | DeedScout | |

Homepage JSON-LD already has `"sameAs": []` in `index.html`. Once you send 2 to 3 real profile URLs, we drop them in and redeploy. Do not invent URLs.

Also add each profile’s website field as `https://deedscout.app/`.

---

## County posts to publish

Use the **county URL**, not the homepage. That feeds the Plausible `county_view` → `pro_intent` funnel.

Copy rules already applied: no em-dashes, no hype words, lead with the missed-sale cost.

### 1. Broward
Link: https://deedscout.app/counties/broward.html

**Short (X / LinkedIn):**
```text
Broward tax deed sale is Oct 26, 2026 · 15 parcels on the list.

Miss the date and the deal is gone. County page with official auction link:
https://deedscout.app/counties/broward.html
```

### 2. Palm Beach
Link: https://deedscout.app/counties/palm-beach.html

**Short:**
```text
Palm Beach tax deed sale is Sep 16, 2026 · 15 parcels scheduled.

One calendar, official clerk/auction link on the page:
https://deedscout.app/counties/palm-beach.html
```

### 3. Miami-Dade
Link: https://deedscout.app/counties/miami-dade.html

**Short:**
```text
Miami-Dade next tax deed sale: Sep 10, 2026.

Verify on the official auction link before you bid:
https://deedscout.app/counties/miami-dade.html
```

### 4. Hillsborough
Link: https://deedscout.app/counties/hillsborough.html

**Short:**
```text
Hillsborough tax deed sale is Sep 17, 2026 · 5 parcels on the current list.

County page + official source:
https://deedscout.app/counties/hillsborough.html
```

### 5. Orange (Orlando)
Link: https://deedscout.app/counties/orange.html

**Short:**
```text
Orange County tax deed sale is Sep 10, 2026 · 8 parcels scheduled.

Track the date, then confirm on the official auction site:
https://deedscout.app/counties/orange.html
```

---

## Posting order

1. Broward  
2. Palm Beach  
3. Hillsborough  
4. Orange  
5. Miami-Dade  

Space them out (one per day is enough). In Plausible, watch `county_view` and `pro_intent` after each post.

## Disclaimer line (optional footer)

```text
Not legal or investment advice. Always verify sale dates on the official clerk or auction site before bidding.
```
