# DeedScout Launch Audit

Last run: 2026-09-04

## Launch score target: **8+/10** (public paid beta)

---

## 1. Sale-date ingestion (RealAuction + curated)

| Check | Status |
|-------|--------|
| Historical RealAuction AWS ELB 403 to bot UAs | Mitigated — browser UA + PREVIEW + `AREA=W` (2026-07-11+) |
| Live scrape recovers dates + parcel counts for most RealAuction counties | Done (~30+ counties on weekly Actions) |
| Foreclosure-only / splash hosts skipped or cadence-only | Done — see `scraper/sources.json` notes |
| `scripts/build_curated_sales.py` cadence for top 10 metros | Done |
| `scraper/scrape_sales.py` merges curated only when scrape empty for that county | Done |
| `tax-deeds.html` shows cadence as **Cached** (not Live) | Done |
| County SEO pages label cadence vs scrape copy | Done |
| GitHub Actions runs `build_curated_sales` before scrape | Done |

**Weekly ops:** Workflow `Scrape Florida Tax Deed Sales` (Mon 06:30 UTC) or run manually. Override specific counties in `data/sale-schedules.json` → `overrides` with `source: manual_verified` after checking official auction portals.

**Known gaps (not global 403):** Lake / Monroe / St. Johns splash pages; Indian River foreclosure-only sibling; marketing redirects (Collier, Columbia, Okaloosa, Sumter, Wakulla). Pinellas uses cadence when PREVIEW has no Certificate days.

---

## 2. E2E auth / checkout / watchlist / export

| Step | How to verify (production URL only) |
|------|--------------------------------------|
| Sign up | https://deedscout.app/tax-deeds.html → Sign In → Create account |
| Email confirm | Link must land on same host (not deploy preview) |
| Pro checkout | `#/pricing` → Subscribe → Stripe live |
| Pro sync | Account → **Refresh subscription status** |
| Watchlist | `#/research` → add parcel → sign in → cloud sync |
| CSV export | `#/research` → **Export CSV (Pro)** — Pro only |

**Automated gates:** `scraper/tests/test_launch_readiness.py`, `scraper/tests/test_public_site.py`

**Netlify env required:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `PUBLIC_SITE_URL=https://deedscout.app`, `STRIPE_WEBHOOK_SECRET`

**Do NOT test auth/checkout on** `*.netlify.app` deploy previews (`--deedscout.netlify.app`).

---

## 3. Custom domain (deedscout.app)

| Step | Status |
|------|--------|
| Netlify primary domain `deedscout.app` | Done |
| DNS + SSL | Done |
| Forced 301 `deedscout.netlify.app` → `deedscout.app` | Done |
| `PUBLIC_SITE_URL=https://deedscout.app` | Done (Netlify env) |
| Client `FTDR_CONFIG.SITE_URL` canonicalizes to deedscout.app | Done |

---

## 4. Labs / plumbing demoted from core nav

| Check | Status |
|-------|--------|
| Removed from `tax-deeds.html` primary nav | Done |
| Removed from homepage Products grid | Done |
| Still available at `/labs/plumbing-reviews.html` | Done |
| `/plumbing-reviews.html` → 301 to Labs | Done |
| Labs link in `assets/deedscout.js` nav `<details>Labs</details>` | Done |

---

## QA checklist (run before announcing launch)

- [ ] `python -m unittest scraper.tests.test_public_site scraper.tests.test_launch_readiness -v`
- [ ] `python scripts/build_curated_sales.py && python scraper/scrape_sales.py && python scripts/build_county_pages.py --base-url https://deedscout.app`
- [ ] Homepage trust banner reflects scraped county count (not “403”)
- [ ] Palm Beach / Miami-Dade county pages show scraper-verified dates when present
- [ ] No plumbing link in Tax Deeds masthead
- [ ] Pro CSV export downloads from Research notebook
- [ ] Sign-in + checkout on **https://deedscout.app/** only
- [ ] Trust Center / Status match in-app badges

---

## Remaining post-launch (not blockers)

- Expand parcel GIS registry beyond current wired metros
- Fund / set `BATCHDATA_API_TOKEN` + `RENTCAST_API_KEY` if AVM/skip-trace vendor calls should succeed in production
- Re-check splash / marketing RealAuction counties when clerks re-enable PREVIEW calendars

### Shipped in this wave
- RealAuction scraper recovery (browser UA + PREVIEW/AREA=W parcel counts)
- Splash-page host detection + honest skip notes for Lake / Indian River / Monroe / St. Johns
- Trust inventory + Tax Deeds copy no longer claim a blanket upstream 403
- Statewide parcel lookup UI via `data/parcels/registry.json` + `assets/parcel-registry.js`
- Bid calculator / AVM / skip-trace UI (`FEATURES.advanced_lookups: true`)
- Stripe webhook async checkout + post-checkout Pro poll; manual refresh remains as fallback
- Custom domain `deedscout.app` primary with Netlify subdomain 301
