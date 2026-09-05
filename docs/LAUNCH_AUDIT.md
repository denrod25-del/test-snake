# DeedScout Launch Audit

Last run: **2026-09-05**  
Production host: **https://deedscout.app/**  
Launch score target: **8+/10** (public paid beta)

---

## Snapshot (current production)

| Area | Status | Notes |
|------|--------|-------|
| Custom domain | **Done** | `deedscout.app` primary; `deedscout.netlify.app` → 301 |
| Tax deed sale dates | **Cached / Live mix** | Last scrape `2026-09-04`: **32** scraped, **1** cadence (Pinellas), **9** skipped |
| Property Intelligence parcels | **Done (31)** | **16** live PA GIS + **15** FDOR cached cadastral |
| Flood stamps | **Live GIS** | County GIS where wired; FEMA NFHL default for other parcel counties |
| Zoning | **Partial** | 11 GIS + PA attrs + Cached FDOR `DOR_UC` land-use (not zoning districts) |
| Auth + Stripe Pro ($49/mo) | **Live** | Test only on `deedscout.app` (not deploy previews) |
| Signal email digests | **Live** | Resend + `deedscout.app` from-domain; cron on `send-alert-digest-cron` |
| Trust labels | **Done** | Live / Cached / Sample / Blocked / Broken / Coming Soon via `assets/data-trust.js` |
| Labs plumbing | **Demoted** | `/labs/plumbing-reviews.html` only — not core nav |

---

## 1. Sale-date ingestion (RealAuction + curated)

| Check | Status |
|-------|--------|
| Historical AWS ELB 403 to bot UAs | **Mitigated** — browser UA + PREVIEW + `AREA=W` (2026-07-11+) |
| Live scrape recovers dates + parcel counts | **Done** — ~32 counties on latest run / weekly Actions |
| Splash / foreclosure-only / marketing hosts skipped | **Done** — honest notes in `scraper/sources.json` |
| Cadence fallback for top metros when scrape empty | **Done** — `scripts/build_curated_sales.py` → Pinellas when Certificate days missing |
| UI labels cadence as **Cached** (not Live) | **Done** |
| County SEO pages label cadence vs scrape | **Done** |
| Public copy no longer claims blanket “403 / Broken” | **Done** (2026-09-04) |
| GitHub Actions: curated → scrape → county pages | **Done** — Mon 06:30 UTC + `workflow_dispatch` |

**Weekly ops:** Actions → *Scrape Florida Tax Deed Sales*, or:

```bash
python scripts/build_curated_sales.py
python scraper/scrape_sales.py
python scripts/build_county_pages.py --base-url https://deedscout.app
```

Override verified dates in `data/sale-schedules.json` → `overrides` with `source: manual_verified`.

**Known gaps (not a global outage):** Lake / Monroe / St. Johns (empty PREVIEW / splash); Indian River (foreclosure-only sibling); marketing redirects (Collier, Columbia, Okaloosa, Sumter, Wakulla). Pinellas uses **cadence** when PREVIEW has no Certificate tax-deed days.

---

## 2. Property Intelligence (parcels / zoning / flood)

| Check | Status |
|-------|--------|
| Parcel registry `data/parcels/registry.json` | **31 counties** |
| Live PA ArcGIS | Bay, Broward, Charlotte, Duval, Hillsborough, Lee, Manatee, Martin, Miami-Dade, Orange, Palm Beach, Pasco, Pinellas, Polk, Sarasota, Volusia |
| FDOR cached cadastral (annual DOR snapshot) | Alachua, Brevard, Clay, Collier, Escambia, Hernando, Indian River, Lake, Leon, Marion, Monroe, Okaloosa, Osceola, Seminole, St. Lucie |
| Flood via county GIS or FEMA NFHL default | **All 31** parcel-wired counties |
| Zoning GIS polygons | Palm Beach, Martin, Lee, Hillsborough, Pasco, Bay, Pinellas (unincorp.), Volusia, Miami-Dade (unincorp.), Broward BMSD, Polk FLU |
| Zoning / land-use from parcel attributes | Charlotte, Manatee, Orange, Sarasota, Duval (+ Lee/Miami-Dade fallbacks); FDOR `DOR_UC` labeled **Cached land-use, not zoning** |
| SPI API `GET /api/property` | Shipped (shop key auth) |
| Permits in PI | Cached cities only (WPB / Boca / Jupiter / St. Lucie) |
| Carrier flood premium rate-shift | **Coming Soon** |

---

## 3. E2E auth / checkout / watchlist / export

| Step | How to verify (**production only**) |
|------|-------------------------------------|
| Sign up | https://deedscout.app/tax-deeds.html → Sign In → Create account |
| Email confirm | Link must land on `deedscout.app` (not deploy preview) |
| Pro checkout | `#/pricing` → Subscribe → Stripe **live** |
| Pro sync | Account → **Refresh subscription status** |
| Watchlist | `#/research` → add parcel → sign in → cloud sync |
| CSV export | `#/research` → **Export CSV (Pro)** |
| PI alerts email | Property Intelligence watch prefs + daily digest (Resend) |

**Automated gates:** `scraper/tests/test_launch_readiness.py`, `scraper/tests/test_public_site.py`, `scraper/tests/test_pi_parcel_coverage.py`

**Netlify env (required):** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL=https://deedscout.app`  
**Optional vendors:** `BATCHDATA_API_TOKEN`, `RENTCAST_API_KEY`, `RESEND_API_KEY`

**Do NOT test auth/checkout on** `*.netlify.app` deploy previews (`--deedscout.netlify.app`).

**Supabase Auth URL config:** Site URL `https://deedscout.app`; Redirect URLs include `https://deedscout.app/**`, `https://www.deedscout.app/**`, and optionally `https://deedscout.netlify.app/**`.

**Stripe webhook:** `https://deedscout.app/api/stripe-webhook` (DeedScout destination — keep other app webhooks separate).

---

## 4. Custom domain (`deedscout.app`)

| Step | Status |
|------|--------|
| Netlify primary domain | **Done** |
| DNS + SSL (apex + www) | **Done** |
| Forced 301 `deedscout.netlify.app` → `deedscout.app` | **Done** (`netlify.toml` + `_redirects`) |
| `PUBLIC_SITE_URL` | **Done** |
| Client `SITE_URL` / function defaults | **Done** — canonicalize to `https://deedscout.app` |
| SEO canonicals / sitemap / llms.txt | **Done** |

---

## 5. Labs / plumbing demoted from core nav

| Check | Status |
|-------|--------|
| Removed from `tax-deeds.html` primary nav | Done |
| Removed from homepage Products grid | Done |
| Available at `/labs/plumbing-reviews.html` | Done |
| `/plumbing-reviews.html` → 301 to Labs | Done |
| Labs under nav `<details>Labs</details>` | Done |

---

## 6. Trust & honesty surfaces

| Surface | Expectation |
|---------|-------------|
| Homepage trust banner | Reflects scraped county count / Cached cadence — **not** “403 offline” |
| `trust.html` / `data-sources.html` | Inventory from `data/data-inventory.json` (regenerate via `scripts/build_data_inventory.py` + `scripts/build_site_fallbacks.py`) |
| `status.html` | Sale scraper = Cached/Recovering language aligned with live scrape |
| In-app badges | Live / Cached / Sample / Blocked / Broken / Coming Soon |
| Sale dates | Scraper-verified or cadence-labeled only; unverified counties → official-source empty state |

---

## QA checklist (before announcing launch)

- [ ] `python -m unittest scraper.tests.test_public_site scraper.tests.test_launch_readiness scraper.tests.test_pi_parcel_coverage -v`
- [ ] Spot-check https://deedscout.app/ — trust banner, Pro CTA, county tiles
- [ ] https://deedscout.app/tax-deeds.html — upcoming sales show Live/Cached honestly
- [ ] https://deedscout.app/property-intelligence.html — Osceola / Lake / Charlotte lookup
- [ ] https://deedscout.netlify.app/ → 301 to `deedscout.app`
- [ ] Sign-in + checkout on **production only**
- [ ] Pro CSV export from Research notebook
- [ ] No plumbing link in Tax Deeds masthead
- [ ] Trust Center / Status / Data Sources match in-app badges

---

## Remaining post-launch (not blockers)

- More live PA GIS where public endpoints exist (prefer over FDOR when stable)
- True zoning GIS for Orange / Duval / Sarasota / Manatee / Charlotte (not just attrs / DOR_UC)
- Re-check splash / marketing RealAuction counties when clerks re-enable PREVIEW
- Fund / set `BATCHDATA_API_TOKEN` + `RENTCAST_API_KEY` if AVM / skip-trace should succeed in production
- Expand municipal permit scrapes beyond cached Tyler EnerGov cities
- Carrier flood premium rate-shift feeds

---

## Shipped recently (2026-09)

- Custom domain cutover + Netlify subdomain 301
- RealAuction scrape refresh (32 counties) + stale 403 trust-copy cleanup
- Property Intelligence → **31** parcel counties (+ FDOR majors: Osceola, Lake, Marion, St. Lucie, Clay, Hernando, Indian River, Okaloosa)
- Charlotte zoning `outFields` fix; FDOR `DOR_UC` as Cached land-use
- Homepage Pro CTA; Stripe live Pro; signal alert digests (Resend)
- SPI parcel matching harden + Broward BMSD zoning
