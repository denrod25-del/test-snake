# Florida Tax Deed Registry — Production Setup

This guide turns the static demo into a working SaaS with real authentication, a real Stripe-powered subscription, and a real paywall. End-to-end this takes **about 60 minutes**, most of which is account creation.

You need three free accounts:

1. **Supabase** — auth + database — https://supabase.com
2. **Stripe** — payments — https://stripe.com
3. **Netlify** — hosting + serverless functions — https://netlify.com

---

## 1. Supabase

### 1a. Create a project
1. Sign in to Supabase, create a new project. Pick the closest region to your users.
2. Save the **database password** somewhere safe — you'll never see it again.
3. Wait for provisioning (~2 minutes).

### 1b. Run the schema
1. In the Supabase dashboard sidebar, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this repo, paste the entire contents, and click **Run**.
3. You should see "Success. No rows returned." This created:
   - `profiles` table (one row per user, holds plan + Stripe IDs)
   - `watchlist_parcels` table (cloud-synced parcels for Pro users)
   - `alert_subscriptions` table (per-county alert preferences)
   - `surplus_history` table (Pro-only data, with 8 sample rows seeded)
   - Row-level security policies on every table
   - A trigger that auto-creates a `profiles` row when a user signs up

### 1c. Configure email auth
1. **Authentication → Providers → Email** — make sure it's enabled (it is by default).
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://deedscout.app` (production) — or your Netlify URL during early setup
   - **Redirect URLs:** add `https://deedscout.app/**`, `https://www.deedscout.app/**`, and `https://deedscout.netlify.app/**` (legacy subdomain still redirects)
3. (Recommended for a real launch) **Authentication → Email Templates** — customize the confirmation and reset emails to match your brand.

### 1d. Grab your keys
**Project Settings → API:**

| Key | What it is | Where it goes |
| --- | --- | --- |
| `Project URL` | e.g. `https://abcd.supabase.co` | `tax-deeds.html` config + Netlify env var `SUPABASE_URL` |
| `anon` `public` key | safe to put in client code | `tax-deeds.html` config |
| `service_role` `secret` key | **NEVER** put in client code | Netlify env var `SUPABASE_SERVICE_KEY` |

---

## 2. Stripe

### 2a. Create the Pro product
1. Sign in to Stripe. Stay in **test mode** while developing (toggle top-right).
2. **Products → Add product**:
   - Name: **Pro**
   - Description: *Florida Tax Deed Registry Pro — unlimited watchlists, multi-county alerts, surplus funds history database.*
   - Pricing: **Recurring / Monthly / $49.00 USD** (or whatever you want — make sure it matches `PRO_PRICE_DISPLAY` in `tax-deeds.html`).
3. Save and copy the **Price ID** (starts with `price_`). You'll need it for `STRIPE_PRICE_ID_PRO`.

### 2b. Configure the customer billing portal
1. **Settings → Billing → Customer portal**.
2. Enable: cancellation, plan switching (off for now since you only have one plan), invoice history, payment method updates.
3. Save.

### 2c. Set up the webhook (do this AFTER deploying to Netlify)
1. **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL:** `https://your-site.netlify.app/api/stripe-webhook`
3. **Events to send:**
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. After creating, **reveal & copy the signing secret** (starts with `whsec_`). This goes into `STRIPE_WEBHOOK_SECRET`.

**Production endpoint for DeedScout:** `https://deedscout.app/api/stripe-webhook`

### 2d. Grab your keys
**Developers → API keys:**

| Key | Where it goes |
| --- | --- |
| **Secret key** (`sk_test_...` or `sk_live_...`) | Netlify env var `STRIPE_SECRET_KEY` |
| **Webhook signing secret** (`whsec_...`) | Netlify env var `STRIPE_WEBHOOK_SECRET` |

---

## 3. Netlify

### 3a. Deploy
1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git → pick the repo**.
3. Build settings: leave everything default (the `netlify.toml` in the repo handles it).
4. Deploy. Note your site URL — e.g. `https://flowery-pyramid-12345.netlify.app`.

### 3b. Add environment variables
**Site configuration → Environment variables → Add a variable** (one at a time):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the **service_role** key from step 1d |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from step 2c) |
| `STRIPE_PRICE_ID_PRO` | `price_...` (from step 2a) |
| `PUBLIC_SITE_URL` | `https://deedscout.app` |
| `BATCHDATA_API_TOKEN` | Bearer token from `app.batchdata.com` (skip-tracing) |
| `RENTCAST_API_KEY` | API key from `app.rentcast.io` (AVM lookups) |
| `PRO_SKIP_TRACE_GRANT` *(optional)* | Monthly skip-trace credits per Pro user. Default: `50` |
| `PRO_AVM_GRANT` *(optional)* | Monthly AVM credits per Pro user. Default: `200` |

**Vendor sign-ups:**

- **BatchData** (skip-tracing) — sign up at https://batchdata.com → Pricing → Pay-as-you-go starts ~$0.05/skip. Get the Bearer token from **API → Tokens**. Docs: https://docs.batchdata.com/reference/skip-trace
- **RentCast** (AVM) — sign up at https://app.rentcast.io → API → Get API key. Free tier (50 calls/mo) is enough for testing; the $74/mo Standard tier (1,000 calls/mo) covers the default 200-AVM-per-user grant for ~5 paying customers. Docs: https://app.rentcast.io/app/api

You can launch without these keys — the Pro UI gates and the React Pricing page still work. Skip-trace and AVM endpoints will return a `vendor_error` (and refund the credit) until the keys are set.

**Run the new SQL migration:**

After the original `schema.sql` ran successfully, also run `supabase/migrations/20260419_data_credits_and_caches.sql` in the Supabase SQL editor. This creates the `data_credits`, `skip_trace_cache`, `avm_cache`, and `credit_ledger` tables plus the `spend_credit`, `refill_monthly_credits`, and `ensure_credit_buckets` RPC functions.

**Stripe webhook events:**

In addition to the events listed in step 2c, also subscribe the webhook to **`invoice.payment_succeeded`** — this is what triggers the monthly credit refill.

After adding env vars, trigger a **redeploy** (Deploys → Trigger deploy → Clear cache and deploy site) so the functions pick up the new variables.

### 3d. Service Property Intelligence (shop API keys)

The `GET /api/property?address=…` briefing API uses **shop API keys**, not DeedScout Pro JWT.

1. In Supabase **SQL Editor**, run `supabase/migrations/20260815_shop_api_keys.sql` (or re-run the shop_api_keys section at the end of `supabase/schema.sql`). Apply this **before** issuing keys or advertising the endpoint.
2. Optional: set Netlify env `SHOP_API_KEY_PEPPER` to a long random string (used when hashing keys). If you set it later, existing keys stop working — re-issue them.
3. Issue a key from the repo root (prints plaintext **once** — store it in your vault; never commit it or log it):

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_KEY=your_service_role_key \
node scripts/issue-shop-api-key.mjs "Acme Plumbing"
```

4. Call the API (server-side only — do not embed shop keys in browser JS):

```bash
curl -sS -H "X-Api-Key: ds_shop_…" \
  "https://deedscout.app/api/property?address=YOUR+ADDRESS&county=palm-beach"
```

5. Local unit tests: `npm run test:spi`

### 3c. Wire the webhook
Now go back to **Stripe → Webhooks** (step 2c) and create the endpoint pointing at the live Netlify URL.

---

## 4. Configure the client

Open `tax-deeds.html`, find this block near the top of `<head>`:

```js
window.FTDR_CONFIG = {
  SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  PRO_PRICE_DISPLAY: "$49",
  AUTH_ENABLED:      true
};
```

Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the values from Supabase step 1d. Commit and push. Netlify will redeploy automatically.

> Tip: setting `AUTH_ENABLED: false` lets you preview the marketing pages (pricing, account, surplus history) without configuring Supabase. Useful for screenshots before you launch.

---

## 5. Test the full flow

### As a free user
1. Open the site → click **Sign In** in the topbar → switch to **Create Account**.
2. Sign up with a real email. Check your inbox and click the confirmation link.
3. Visit `#/research` and try to add 6+ parcels — the 6th should trigger the upgrade prompt.
4. Visit `#/surplus-history` — you should see the locked preview with the "Subscribe" CTA.

### As a Pro subscriber
1. Click **Pro** in the nav → **Subscribe to Pro**.
2. You'll land on Stripe Checkout. Use test card **`4242 4242 4242 4242`**, any future expiry, any CVC, any ZIP.
3. After paying, you're redirected to `#/account?checkout=success`.
4. Within ~30 seconds the webhook fires and your `profiles.subscription_plan` flips to `pro`. Refresh the page — you should see the **PRO** badge in the topbar.
5. Visit `#/surplus-history` — full database, search, and filters now work.
6. Add a parcel in `#/research` — it'll sync to `watchlist_parcels` in Supabase. Sign in on a different browser to verify cross-device sync.
7. Click **Manage Billing** on `#/account` to test the Stripe portal.

### Verify the data
In Supabase → **Table Editor**:
- `profiles` row has `subscription_status='active'`, `subscription_plan='pro'`, populated `stripe_customer_id` and `stripe_subscription_id`.
- `watchlist_parcels` rows show up as you add them in the UI.

---

## 6. Going live

Before flipping Stripe to live mode:

- [ ] Replace test keys with live keys in Netlify env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- [ ] Create a **second** webhook endpoint in Stripe live mode pointing at the same `/api/stripe-webhook` URL — webhooks are mode-specific.
- [ ] Recreate the **Pro** product in live mode and update `STRIPE_PRICE_ID_PRO`.
- [ ] Add a Privacy Policy and Terms of Service page (legally required to charge customers).
- [ ] Make sure the surplus-funds disclaimer is prominent — you are not providing legal advice.
- [ ] Add a real domain in Netlify and update Supabase Site URL + Stripe webhook URL accordingly.
- [ ] Set up Stripe tax collection if you owe sales tax in your state.

---

## 7. Architecture cheat sheet

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│   tax-deeds.html  ──►  Supabase JS SDK  (auth, watchlist CRUD)  │
│                   ──►  /api/checkout    (POST → Stripe URL)     │
│                   ──►  /api/portal      (POST → portal URL)     │
└─────────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
     ┌────────────────────┐         ┌──────────────────────────┐
     │   Supabase         │         │  Netlify Functions       │
     │   - auth.users     │         │  - create-checkout       │
     │   - profiles       │ ◄────── │  - create-portal         │
     │   - watchlists     │         │  - stripe-webhook        │
     │   - surplus_history│         └──────────────────────────┘
     └────────────────────┘                       ▲
              ▲                                    │
              │   webhook updates plan/status      │
              └────────────────────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │   Stripe    │
                          │  Checkout + │
                          │   Billing   │
                          └─────────────┘
```

**Trust boundary:** the **anon key** in the browser is safe — Row-Level Security policies (defined in `supabase/schema.sql`) prevent users from reading anyone else's data. The **service_role key** lives only inside Netlify functions, where it's used to update profile rows after webhook events.

**Paywall enforcement:** the `surplus_history` RLS policy checks `profiles.subscription_plan = 'pro'`, so even if a free user crafted a direct API call they'd get an empty result. Don't ever drop that policy.

---

## 8. Common issues

**Webhook isn't firing**
- Verify the URL in Stripe matches exactly: `https://your-site.netlify.app/api/stripe-webhook`
- Check **Stripe → Developers → Events** to see if events are being sent and what response they got.
- If you see `400 Webhook Error: No signatures found matching the expected signature`, your `STRIPE_WEBHOOK_SECRET` env var is wrong or missing.

**User subscribed but still shows as free**
- Check the **Functions** logs in Netlify (Site → Logs → Functions → `stripe-webhook`).
- Look at the row in `profiles` for that user — is `stripe_customer_id` populated? If not, the checkout session never created one.
- Confirm the `subscription_data.metadata.supabase_user_id` was passed in the checkout session (look at the session in Stripe Dashboard).

**Sign up succeeds but no profile row created**
- The `on_auth_user_created` trigger didn't run. In Supabase **Database → Triggers**, verify it exists and points at `handle_new_user`. If not, re-run `schema.sql`.

**"Configure SUPABASE_URL" alert when clicking Sign In**
- You haven't replaced the placeholder values in the `FTDR_CONFIG` block of `tax-deeds.html`.

---

## 9. The Vite app (`app/`)

The site has been refactored into a proper Vite + React + TypeScript application living in `app/`. The legacy single-file `tax-deeds.html` continues to work as a fallback while you cut over.

### 9a. Run it locally

```bash
cd app
cp .env.example .env.local
# edit .env.local with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev          # starts at http://localhost:5173
```

For full Stripe + Supabase flow locally, run `netlify dev` from the **repo root** in another terminal. The Vite proxy in `vite.config.ts` forwards `/api/*` to `http://localhost:8888` where Netlify's CLI serves the functions.

### 9b. Layout

```
app/
├─ index.html
├─ vite.config.ts            # /api/* proxy to netlify dev
├─ src/
│  ├─ main.tsx               # HashRouter + Auth provider + Modal provider
│  ├─ App.tsx                # all routes
│  ├─ styles.css             # 1:1 port of the legacy CSS
│  ├─ contexts/AuthContext.tsx
│  ├─ components/            # Layout, Topbar, Masthead, Footer, Hero, AuthModal
│  ├─ data/                  # counties, schedules, statutes
│  ├─ hooks/useUpcoming.ts   # fetches /sales.json with fallback
│  ├─ lib/                   # config, supabase, parcels (cloud sync), helpers, types
│  └─ pages/                 # Registry, CountyDetail, Upcoming, Surplus,
│                            # SurplusHistory, Statute, Research, Pricing,
│                            # Account, Privacy, Terms
```

### 9c. Deploy the Vite app instead of the legacy site

When you're ready to flip the cutover:

1. Open `netlify.toml`.
2. **Comment out** the current legacy `[build]` block.
3. **Uncomment** the Vite block at the top of the file:
   ```toml
   [build]
     base      = "app"
     command   = "npm install && npm run build"
     publish   = "app/dist"
     functions = "../netlify/functions"
   ```
4. Add Vite env vars in **Netlify → Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PRO_PRICE_DISPLAY` (optional, defaults to `$49`)
5. Push. Netlify will run `npm install && npm run build` inside `app/` and serve `app/dist`.

The Netlify Functions still live in `netlify/functions/` and the `/api/*` redirects continue to work. Nothing about the Stripe or Supabase configuration changes.

### 9d. Routing

The Vite app uses `HashRouter`, so URLs look like `https://your-site/#/county/orange` — exactly the same pattern as the legacy single-file site. This is intentional:
- No SPA fallback redirect needed (works on any static host).
- Existing bookmarks and shared links continue to work.
- Search engine crawlers see the meta tags from `index.html` and the rendered React app via JS.

If you later want clean URLs (`/county/orange`), switch `HashRouter` to `BrowserRouter` in `app/src/main.tsx` and add a Netlify redirect:
```toml
[[redirects]]
  from = "/*"
  to   = "/index.html"
  status = 200
```

---

## 10. Surplus-funds scraper

A weekly scraper pulls Clerk surplus reports and pushes them into the `surplus_history` table that powers the Pro-only surplus database.

### 10a. Files

```
scraper/
├─ parsers_surplus.py     # generic clerk_html_table + realauction_surplus parsers
├─ sources_surplus.json   # per-county source URLs and parser names
├─ manual_surplus.json    # manual entries for in-person counties / PDF-only sources
└─ scrape_surplus.py      # orchestrator; upserts directly into Supabase
.github/workflows/scrape-surplus.yml   # weekly cron at Tuesday 07:30 UTC
```

The scraper uses the `(county, sale_date, parcel_id)` natural key to upsert, so re-running is idempotent. The unique index for that key is in `supabase/schema.sql` (`surplus_natkey_idx`).

### 10b. Run it manually

```bash
cd scraper
pip install -r requirements.txt
export SUPABASE_URL=https://YOUR-PROJECT.supabase.co
export SUPABASE_SERVICE_KEY=...           # the service_role key, not anon
python scrape_surplus.py --dry-run        # preview without writing
python scrape_surplus.py --only Orange    # just one county
python scrape_surplus.py --verbose        # full run with debug logging
```

### 10c. Wire the GitHub Action

The workflow file (`.github/workflows/scrape-surplus.yml`) is already in the repo. To make it work:

1. **GitHub repo → Settings → Secrets and variables → Actions → New repository secret** (these likely already exist for the sales scraper):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
2. The workflow runs every **Tuesday at 07:30 UTC** (offset from the sales scraper's 07:00 to spread load). You can also trigger it manually via **Actions → Scrape surplus funds → Run workflow**.
3. Watch the run logs — counties whose Clerk pages have changed structure will log a `parser crashed` line. Fix the parser or move the county to `manual_surplus.json` until you can.

### 10d. Add or fix a county

- **Easy case (Clerk publishes an HTML table):** add an entry to `sources_surplus.json`:
  ```json
  "Sumter": { "parser": "clerk_html_table", "url": "https://www.sumterclerk.com/tax-deed-surplus" }
  ```
  The generic table parser tries to detect columns like `Sale Date`, `Parcel`, `Owner`, `Surplus Amount`, `Status`. It's not magic — verify with `--only Sumter --dry-run` before trusting the output.
- **Realauction-style:** use parser `"realauction_surplus"` with the county's realtaxdeed.com URL.
- **PDF-only or in-person counties:** drop entries directly into `manual_surplus.json` (sample shape is at the top of that file).

---

## 11. What's where (quick map)

```
test snake/
├─ tax-deeds.html              # legacy single-file site (still works)
├─ privacy.html, terms.html    # standalone legal pages used by the legacy site
├─ landing.html, index.html    # marketing landing page + redirect
├─ sales.json                  # written by sales scraper, served as live feed
├─ supabase/schema.sql         # Postgres schema, RLS, surplus natkey index
├─ scraper/
│  ├─ scrape_sales.py + parsers.py + sources.json + manual_sales.json
│  └─ scrape_surplus.py + parsers_surplus.py + sources_surplus.json + manual_surplus.json
├─ netlify/functions/          # serverless: Stripe checkout, portal, webhook
├─ netlify.toml                # build config + /api/* redirects + caching
├─ app/                        # NEW Vite + React + TS app
│  ├─ src/...
│  └─ dist/  (after `npm run build`)
└─ .github/workflows/
   ├─ scrape-sales.yml         # daily, sales
   └─ scrape-surplus.yml       # weekly, surplus
```

