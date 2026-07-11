# DeedScout Launch Audit

Last run: 2026-07-11

## Launch score target: **8+/10** (public paid beta)

---

## 1. Sale-date ingestion (curated top metros)

| Check | Status |
|-------|--------|
| RealAuction scraper still 403 upstream | Known — automated scrape **Broken** |
| `scripts/build_curated_sales.py` generates cadence dates for top 10 metros | Done |
| `scraper/scrape_sales.py` merges curated with `source: cadence` | Done |
| `tax-deeds.html` shows cadence dates as **Cached** (not Live) | Done |
| County SEO pages label cadence vs scrape copy | Done |
| GitHub Actions runs `build_curated_sales` before scrape | Done |

**Weekly ops:** Run `python scripts/build_curated_sales.py && python scraper/scrape_sales.py` before major sale weeks. Override specific counties in `data/sale-schedules.json` → `overrides` with `source: manual_verified` after checking official auction portals.

---

## 2. E2E auth / checkout / watchlist / export

| Step | How to verify (production URL only) |
|------|--------------------------------------|
| Sign up | https://deedscout.netlify.app/tax-deeds.html → Sign In → Create account |
| Email confirm | Link must land on same host (not deploy preview) |
| Pro checkout | `#/pricing` → Subscribe → Stripe test/live |
| Pro sync | Account → **Refresh subscription status** |
| Watchlist | `#/research` → add parcel → sign in → cloud sync |
| CSV export | `#/research` → **Export CSV (Pro)** — Pro only |

**Automated gates:** `scraper/tests/test_launch_readiness.py`, `scraper/tests/test_public_site.py`

**Netlify env required:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `PUBLIC_SITE_URL` (optional; defaults to deedscout.app in functions)

**Do NOT test auth/checkout on** `*.netlify.app` deploy previews (`--deedscout.netlify.app`).

---

## 3. Custom domain (deedscout.app)

| Step | Status |
|------|--------|
| Netlify → Domain management → Add `deedscout.app` | **Manual — user action** |
| DNS: CNAME or Netlify DNS | **Manual — user action** |
| Set `deedscout.app` as primary domain | **Manual — user action** |
| Uncomment 301 redirect in `netlify.toml` (netlify.app → deedscout.app) | Ready when DNS live |
| Set `PUBLIC_SITE_URL=https://deedscout.app` in Netlify env | Recommended after DNS |
| Client `FTDR_CONFIG.SITE_URL` auto-detects host | Done |

**Note:** Forced redirect is **commented out** until DNS is verified — enabling early would break production.

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
- [ ] `python scripts/build_curated_sales.py && python scraper/scrape_sales.py && python scripts/build_county_pages.py --base-url https://deedscout.netlify.app`
- [ ] Homepage hero mentions scraper offline + cadence for top metros
- [ ] Palm Beach / Miami-Dade county pages show typical sale dates with cadence label
- [ ] No plumbing link in Tax Deeds masthead
- [ ] Pro CSV export downloads from Research notebook
- [ ] Sign-in + checkout on **production** URL only
- [ ] Trust Center / Status match in-app badges

---

## Remaining post-launch (not blockers)

- Expand parcel GIS registry beyond current wired metros
- Enable deedscout.app 301 when DNS is live
- Confirm Stripe Dashboard webhook includes `checkout.session.completed`, `checkout.session.async_payment_succeeded`, subscription.*, and `invoice.payment_*` with `STRIPE_WEBHOOK_SECRET` set on Netlify
- Fund / set `BATCHDATA_API_TOKEN` + `RENTCAST_API_KEY` if AVM/skip-trace vendor calls should succeed in production

### Shipped in this wave
- RealAuction scraper recovery (browser UA + PREVIEW/AREA=W parcel counts)
- Statewide parcel lookup UI via `data/parcels/registry.json` + `assets/parcel-registry.js`
- Bid calculator / AVM / skip-trace UI (`FEATURES.advanced_lookups: true`)
- Stripe webhook async checkout + post-checkout Pro poll; manual refresh remains as fallback
