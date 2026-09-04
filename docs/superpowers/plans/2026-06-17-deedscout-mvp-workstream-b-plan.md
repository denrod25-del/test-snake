# DeedScout MVP — Workstream B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Manual vendor-dashboard tasks require human action and cannot be subagent-automated — they are marked **[manual]**.

**Goal:** Take `tax-deeds.html` from placeholder-keyed prototype to a live, paying-customer-capable production deployment at `https://deedscout.app`.

**Architecture:** No code architecture changes. Existing static site (`tax-deeds.html`) deploys via Netlify; auth/data lives in Supabase; billing via Stripe Checkout + Netlify Functions; DNS via Cloudflare Registrar. The work is substituting real credentials for placeholders, registering a domain, hiding two not-launching features, and proving the end-to-end flow with a smoke test.

**Tech Stack:** HTML/CSS/JS (single-file), Supabase (Postgres + auth + RLS), Stripe (Checkout + Customer Portal + webhooks), Netlify (static hosting + serverless functions), Cloudflare Registrar (domain), `.app` TLD (HSTS-preloaded).

**Reference spec:** `docs/superpowers/specs/2026-06-17-deedscout-mvp-workstream-b-design.md`

**Notation:**
- **[manual]** — vendor dashboard work, cannot be agent-automated
- **[code]** — repo changes; TDD-style steps where applicable

---

## Task 1: Register `deedscout.app` at Cloudflare Registrar **[manual]**

**Files:** none — external vendor work

- [ ] **Step 1: Create or sign in to a Cloudflare account**

  Visit https://dash.cloudflare.com/sign-up if you don't have one. Free.

- [ ] **Step 2: Buy the domain**

  Go to https://dash.cloudflare.com/?to=/:account/domains/register/deedscout.app
  (or: Cloudflare dashboard → Domain Registration → Register Domains → search "deedscout.app")

  Expected price: ~$14/yr. Cloudflare Registrar is at-cost with no markups and free WHOIS privacy included.

- [ ] **Step 3: Complete purchase**

  Add payment method, complete checkout. After purchase, the domain shows up in **Websites** in the Cloudflare dashboard.

- [ ] **Step 4: Verify**

  Run from any terminal: `nslookup deedscout.app`

  Expected: a Cloudflare nameserver response (the domain now exists; DNS will be pointed at Netlify in Task 12).

---

## Task 2: Create the Supabase project **[manual]**

**Files:** none — external vendor work

- [ ] **Step 1: Sign up / sign in at Supabase**

  https://supabase.com/dashboard → Sign in (use GitHub OAuth for fastest setup).

- [ ] **Step 2: Create a new project**

  Click **New Project**. Fill in:
  - **Name:** `deedscout-prod`
  - **Database Password:** generate a strong one and **save it in a password manager** — you cannot recover it later
  - **Region:** `East US (us-east-1)` (closest to Florida users + lowest Netlify latency)
  - **Pricing plan:** Free

  Click **Create new project**. Wait ~2 minutes for provisioning.

- [ ] **Step 3: Capture three credentials**

  Once the project is provisioned, go to **Project Settings → API**. Capture and save these three values to your password manager (label them clearly):

  1. **Project URL** — looks like `https://abcdwxyz.supabase.co`
  2. **anon public key** — long JWT starting with `eyJ...` (safe to expose in client code)
  3. **service_role secret key** — long JWT starting with `eyJ...` (SERVER-ONLY — never commit, never expose in client)

- [ ] **Step 4: Verify**

  In the Supabase dashboard, click **Table Editor**. You should see an empty database with only the default `auth` schema. Confirms project is reachable.

---

## Task 3: Apply the database schema **[manual]**

**Files:** uses existing `supabase/schema.sql`

- [ ] **Step 1: Open the SQL Editor in Supabase**

  Supabase dashboard → **SQL Editor** → **New query**.

- [ ] **Step 2: Paste the full contents of `supabase/schema.sql`**

  In your local repo, open `supabase/schema.sql`, copy the entire file (Ctrl+A, Ctrl+C), paste into the Supabase SQL Editor.

- [ ] **Step 3: Run the query**

  Click **Run** (or Ctrl+Enter). Expected: green "Success. No rows returned" message at the bottom.

  Common error: if you re-run this on a non-empty database, some statements may fail with "already exists." That's fine — the schema uses `create table if not exists` / `create policy if not exists` style guards.

- [ ] **Step 4: Verify all tables exist**

  Supabase dashboard → **Table Editor**. You should see these tables under the `public` schema:
  - `profiles`
  - `watchlist_parcels`
  - `alert_subscriptions`
  - `surplus_history`

  (There may be more — that's fine. Confirm at minimum these four are present.)

- [ ] **Step 5: Verify RLS is enabled on each table**

  Click each table → **Auth Policies** tab. Each table should show **Row Level Security: enabled** and have at least one policy listed.

  If RLS is **disabled** on any table, that's a critical bug — stop and re-run the schema, or contact the schema author.

---

## Task 4: Configure Supabase Auth **[manual]**

**Files:** none

- [ ] **Step 1: Set Site URL**

  Supabase dashboard → **Authentication → URL Configuration**.
  - **Site URL:** `https://deedscout.app`
  - **Redirect URLs:** add `https://deedscout.app/**` (allows redirects to any path on the domain)

  Click **Save**.

- [ ] **Step 2: Enable email/password provider**

  **Authentication → Providers → Email**.
  - **Enable Email provider:** ON
  - **Confirm email:** ON (forces email confirmation before login; reduces spam signups)

  Click **Save**.

- [ ] **Step 3: (Optional but recommended) Set email rate limits**

  **Authentication → Rate Limits**. Leave at defaults for MVP — Supabase's free tier rate limits are appropriate for a launch.

---

## Task 5: Create Stripe account and Pro product **[manual]**

**Files:** none

- [ ] **Step 1: Create a Stripe account in test mode**

  https://dashboard.stripe.com/register → fill in business email, country (United States), and confirm. You can do live-business activation later; for now stay in **test mode** (toggle in the top-left).

- [ ] **Step 2: Complete the bare-minimum business profile**

  Stripe dashboard → **Settings → Business settings → Public details**.
  - **Business name:** DeedScout
  - **Statement descriptor:** `DEEDSCOUT.APP` (uppercase, max 22 chars — what shows on customer credit-card statements)
  - **Support email:** your email (will eventually be `support@deedscout.app` post-MVP)

  Click **Save**.

- [ ] **Step 3: Create the Pro product**

  Stripe dashboard → **Products → Add product**.
  - **Name:** `DeedScout Pro`
  - **Description:** `Pro subscription — unlimited research notebook, email alerts, and surplus-history lookups for Florida tax-deed investors.`
  - **Pricing model:** Standard pricing
  - **Price:** `29.00 USD`
  - **Billing period:** Monthly recurring
  - **Include tax:** off (handle taxes manually for now — most US states don't tax SaaS subscriptions)

  Click **Save product**. The price detail page appears.

- [ ] **Step 4: Capture the price ID**

  On the price detail page, find the **Price ID** field. Format: `price_xxxxxxxxxxxxxxxxxxxxxx`. Save this to your password manager labeled `STRIPE_PRICE_ID_PRO (test)`.

- [ ] **Step 5: Capture the test API key**

  Stripe dashboard → **Developers → API keys**.
  - Reveal the **Secret key** under "Standard keys" (starts with `sk_test_`). Save this to your password manager labeled `STRIPE_SECRET_KEY (test)`.

- [ ] **Step 6: (Don't activate live mode yet)**

  Live-mode activation requires business identity verification (EIN/SSN, bank account). Save that for Task 15 — after smoke tests pass.

---

## Task 6: Connect Netlify to the GitHub repo **[manual]**

**Files:** none — uses existing `netlify.toml`

- [ ] **Step 1: Sign in / sign up at Netlify**

  https://app.netlify.com/signup — use GitHub OAuth (recommended; auto-connects your repos).

- [ ] **Step 2: Add the site from GitHub**

  Netlify dashboard → **Add new site → Import an existing project → Deploy with GitHub**.

  Authorize Netlify to access your GitHub account. Select repo `denrod25-del/test-snake`.

- [ ] **Step 3: Configure build settings**

  Netlify auto-detects from `netlify.toml`. Confirm:
  - **Branch to deploy:** `master`
  - **Base directory:** *(blank — project root)*
  - **Build command:** *(blank — no build step)*
  - **Publish directory:** `.`
  - **Functions directory:** `netlify/functions` (auto-detected)

  Click **Deploy site**.

- [ ] **Step 4: Wait for first deploy**

  Wait ~30s for the first deploy. Netlify will assign a random subdomain like `https://celestial-otter-1234ab.netlify.app`. Don't panic if you see the empty-data state — that's expected until Workstream C populates `sales.json`.

- [ ] **Step 5: Rename the site to something predictable**

  Netlify dashboard → **Site configuration → Change site name** → set to `deedscout`. The temporary URL becomes `https://deedscout.app` (we'll point the real domain at this in Task 12).

- [ ] **Step 6: Verify**

  Visit `https://deedscout.app`. Expected: the registry page loads with the 67 counties listed. Auth UI will say "Configure SUPABASE_URL in tax-deeds.html to enable auth" — that's expected until Task 8.

---

## Task 7: Hide AVM + skip-trace UI behind a feature flag **[code]**

**Files:**
- Modify: `tax-deeds.html` around lines 17–22 (config block), and the renderer call sites

**Rationale:** AVM and skip-trace cost ongoing money (RentCast, BatchData) and aren't part of the MVP Pro pitch. We add a feature flag default-off so the UI surfaces a "Coming soon" instead of broken/empty panels.

- [ ] **Step 1: Add FEATURES to FTDR_CONFIG**

  Modify `tax-deeds.html` lines 17–22. Replace:

  ```html
      window.FTDR_CONFIG = {
        SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
        SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
        PRO_PRICE_DISPLAY: "$49",
        AUTH_ENABLED:      true   // set to false to disable auth UI entirely (preview mode)
      };
  ```

  with:

  ```html
      window.FTDR_CONFIG = {
        SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
        SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
        PRO_PRICE_DISPLAY: "$29",
        AUTH_ENABLED:      true,
        FEATURES: {
          // Flip to true after RentCast + BatchData accounts are funded and tested.
          advanced_lookups: false
        }
      };
  ```

  Notice three changes: price display flips from `$49` to `$29`, a new `FEATURES` object is added, and a trailing comma after `AUTH_ENABLED: true`.

- [ ] **Step 2: Find the parcel-detail render function**

  Open `tax-deeds.html` and search for `const liveBlock = renderLiveBlock(p);` — should be around line 5689. This is where the per-parcel detail page assembles its sections.

- [ ] **Step 3: Wrap the bid-calc and skip-trace blocks behind the flag**

  Around lines 5689–5692, the original code is:

  ```javascript
        const liveBlock = renderLiveBlock(p);
        const permitsBlock = renderPermitsBlock(p);
        const riskBlock = renderRiskBlock(p);
        const bidBlock = renderBidCalc(p);
  ```

  Replace with:

  ```javascript
        const liveBlock = renderLiveBlock(p);
        const permitsBlock = renderPermitsBlock(p);
        const advLookupsOn = !!window.FTDR_CONFIG?.FEATURES?.advanced_lookups;
        const riskBlock = advLookupsOn ? renderRiskBlock(p) : renderComingSoon('Risk & skip-trace analysis');
        const bidBlock  = advLookupsOn ? renderBidCalc(p)   : renderComingSoon('Bid calculator with AVM');
  ```

- [ ] **Step 4: Add the `renderComingSoon` helper**

  Just above `function renderBidCalc(p) {` (around line 5396), add:

  ```javascript
      function renderComingSoon(label) {
        return `
          <div class="coming-soon-block" style="margin:18px 0;padding:18px 20px;border:1px dashed var(--rule);background:var(--paper-2);border-radius:4px;text-align:center;">
            <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Coming soon</div>
            <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:var(--ink);">${label}</div>
            <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">This feature is being prepared for launch. Pro subscribers get it first.</div>
          </div>
        `;
      }
  ```

- [ ] **Step 5: Verify in browser**

  Open the file from project root via the existing index redirect:

  ```bash
  start index.html
  ```

  In the browser:
  1. Hard-refresh (Ctrl+F5)
  2. Add a parcel to the Research Notebook (any county → click "Add to research")
  3. Open the parcel detail
  4. Expected: where the Risk Analysis and Bid Calculator panels used to be, you now see two "Coming soon" dashed-border boxes
  5. Open browser DevTools console — confirm **no JavaScript errors**

- [ ] **Step 6: Commit**

  ```bash
  git add tax-deeds.html
  git commit -m "feat: hide AVM/skip-trace behind FEATURES.advanced_lookups flag

  AVM (RentCast) and skip-trace (BatchData) are not part of the MVP Pro
  pitch. Gate both behind a default-off feature flag and render a
  'Coming soon' placeholder in their place. Flip to true after the
  third-party accounts are funded.

  Also: bump PRO_PRICE_DISPLAY from \$49 to \$29 to match MVP pricing."
  ```

---

## Task 8: Replace placeholder Supabase config **[code]**

**Files:**
- Modify: `tax-deeds.html` lines 17–22

**Prerequisite:** Task 2 complete (real Supabase URL + anon key in hand).

- [ ] **Step 1: Substitute real values**

  In `tax-deeds.html`, replace:

  ```javascript
        SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
        SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  ```

  with the actual project URL and anon key from Task 2 Step 3. Example (use your real values):

  ```javascript
        SUPABASE_URL:      "https://abcdwxyz.supabase.co",
        SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-anon-key...",
  ```

  ⚠️ Only the **anon** key goes here. **Never** put the service_role key in client code.

- [ ] **Step 2: Verify locally**

  Open `index.html` in browser (it redirects to `tax-deeds.html`).

  Expected: the top-right of the page now shows a real **Sign In** link (previously: a dummy link saying "Configure SUPABASE_URL"). Clicking it opens the auth modal.

- [ ] **Step 3: Verify auth round-trip in browser DevTools console**

  ```javascript
  // From DevTools console, anywhere on the page:
  window.supabase.auth.getSession().then(r => console.log(r));
  ```

  Expected: `{ data: { session: null }, error: null }` (no session yet, no error). Confirms the Supabase client initialized correctly.

- [ ] **Step 4: Commit**

  ```bash
  git add tax-deeds.html
  git commit -m "config: wire real Supabase project URL + anon key

  Replaces YOUR-PROJECT placeholders with live deedscout-prod values.
  Anon key is safe to commit; row-level security policies enforce
  access. Service role key remains server-only and is set in Netlify
  env vars (Task 9)."
  ```

- [ ] **Step 5: Push to GitHub**

  ```bash
  git push origin master
  ```

  This triggers a Netlify deploy automatically. Watch progress at https://app.netlify.com/sites/deedscout/deploys.

---

## Task 9: Set Netlify environment variables **[manual]**

**Files:** none

**Prerequisite:** Tasks 2 (Supabase keys) and 5 (Stripe keys + price ID) complete.

- [ ] **Step 1: Open Netlify environment variables**

  Netlify dashboard → site `deedscout` → **Site configuration → Environment variables → Add a variable**.

- [ ] **Step 2: Add the six required variables**

  Add each of these, one at a time. For each: click **Add a variable → Add a single variable**, fill in **Key** and **Value**, set **Scopes** to **All scopes** (default). The values come from earlier tasks — copy from your password manager.

  | Key | Value source | Notes |
  |---|---|---|
  | `SUPABASE_URL` | Task 2 Step 3 (Project URL) | e.g. `https://abcdwxyz.supabase.co` |
  | `SUPABASE_ANON_KEY` | Task 2 Step 3 (anon key) | `eyJ...` |
  | `SUPABASE_SERVICE_KEY` | Task 2 Step 3 (service_role key) | `eyJ...` — SERVER ONLY |
  | `STRIPE_SECRET_KEY` | Task 5 Step 5 | `sk_test_...` |
  | `STRIPE_PRICE_ID_PRO` | Task 5 Step 4 | `price_...` |
  | `STRIPE_WEBHOOK_SECRET` | placeholder for now | enter `whsec_PLACEHOLDER` — will replace in Task 11 |

- [ ] **Step 3: Trigger a redeploy so functions see the new env vars**

  Netlify dashboard → **Deploys → Trigger deploy → Deploy site**.

  Wait for the deploy to go green (~30s).

- [ ] **Step 4: Verify**

  Hit `https://deedscout.app/api/checkout` directly in the browser. Expected: an error response (because the function expects a POST with a JWT), but the function should be **reachable** — meaning you get a JSON error like `{"error":"Method not allowed"}` or similar, not a 404 or a Netlify "Function not found" page.

---

## Task 10: Trigger Netlify build & smoke-check the deploy **[manual]**

**Files:** none

- [ ] **Step 1: Visit the Netlify staging URL**

  https://deedscout.app

- [ ] **Step 2: Smoke check the registry**

  - Page loads with masthead "Florida Tax Deed Registry"
  - The 67 counties render in the table
  - Top-right shows **Sign In** (a real link, not the dummy "Configure SUPABASE_URL" message)
  - Browser DevTools console: no red errors

  If any check fails, stop here and debug before proceeding — DNS task next depends on this working.

- [ ] **Step 3: Smoke check Coming-Soon placeholders**

  - Click any county → "Add to Research" → open Research notebook → expand the parcel
  - Where Risk Analysis and Bid Calculator used to be, you see two dashed-border "Coming soon" cards
  - No JavaScript errors

---

## Task 11: Configure Stripe webhook **[manual]**

**Files:** none

**Prerequisite:** Task 10 complete (staging URL works).

- [ ] **Step 1: Add a webhook endpoint in Stripe**

  Stripe dashboard (test mode) → **Developers → Webhooks → Add endpoint**.

  - **Endpoint URL:** `https://deedscout.app/api/stripe-webhook`
    (We'll change this to the real domain after Task 12 DNS cutover.)
  - **Description:** `DeedScout subscription state sync`
  - **Listen to:** Events on your account
  - **Select events:** click "+ Select events" and add exactly these six:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`

  Click **Add endpoint**.

- [ ] **Step 2: Capture the signing secret**

  On the endpoint detail page, click **Reveal** next to **Signing secret**. Format: `whsec_xxxxxxxxxxxxxxxxxxxxxxx`. Copy.

- [ ] **Step 3: Update Netlify env**

  Netlify → site `deedscout` → **Environment variables**. Click the existing `STRIPE_WEBHOOK_SECRET` variable (set to `whsec_PLACEHOLDER` in Task 9) → **Edit** → paste the real secret → **Save**.

- [ ] **Step 4: Trigger a redeploy**

  Netlify → **Deploys → Trigger deploy → Deploy site**. Wait green.

- [ ] **Step 5: Send a test event**

  Stripe dashboard → **Developers → Webhooks → click your endpoint → Send test webhook**. Pick event `checkout.session.completed`. Click **Send test webhook**.

  Expected: Stripe shows **200 OK** response from your endpoint within 5 seconds.

  If you see **400 Bad Request: signature mismatch** — the webhook secret wasn't saved correctly. Recheck Step 3.

  If you see **500** — open Netlify → **Functions → stripe-webhook → Function log** to see the actual error.

---

## Task 12: Point DNS at Netlify **[manual]**

**Files:** none

**Prerequisite:** Task 1 (domain registered) and Task 10 (site loads on staging URL).

- [ ] **Step 1: Add custom domain in Netlify**

  Netlify dashboard → site `deedscout` → **Domain management → Add custom domain** → enter `deedscout.app` → click **Verify** → **Add domain**.

  Netlify will say "DNS records not yet pointing to Netlify." That's expected.

- [ ] **Step 2: Configure DNS in Cloudflare**

  Cloudflare dashboard → **deedscout.app** → **DNS → Records → Add record**.

  Add two records:

  **Apex (root):**
  - Type: `A`
  - Name: `@`
  - IPv4 address: `75.2.60.5` (Netlify's load-balancer IP — confirm current value from Netlify's "DNS records" tab in case it changes)
  - Proxy status: **DNS only** (gray cloud — Netlify handles HTTPS)
  - TTL: Auto

  **www subdomain:**
  - Type: `CNAME`
  - Name: `www`
  - Target: `deedscout.app`
  - Proxy status: **DNS only**
  - TTL: Auto

  Click **Save** for each.

- [ ] **Step 3: Wait for DNS propagation**

  Usually 1–5 minutes. Verify from any terminal:

  ```bash
  nslookup deedscout.app
  ```

  Expected: resolves to `75.2.60.5` (or whatever Netlify currently shows).

- [ ] **Step 4: Wait for Let's Encrypt certificate**

  Netlify dashboard → **Domain management → HTTPS** → should auto-provision the certificate within 5 minutes of DNS resolving. Status should show **HTTPS is enabled**.

  If it stays stuck on **provisioning**, click **Renew certificate** to retry.

- [ ] **Step 5: Update Stripe webhook URL**

  Stripe dashboard → **Developers → Webhooks → click your endpoint → "..." menu → Update details**.
  - Change URL from `https://deedscout.app/api/stripe-webhook` to `https://deedscout.app/api/stripe-webhook`.
  - Save.

- [ ] **Step 6: Update Supabase Site URL**

  Supabase dashboard → **Authentication → URL Configuration → Site URL** → if it's still the Netlify URL, change to `https://deedscout.app`. (You may have already done this in Task 4.)

- [ ] **Step 7: Verify HTTPS works end-to-end**

  Visit `https://deedscout.app` in an incognito window. Expected: registry page loads, green padlock in address bar.

---

## Task 13: End-to-end smoke test (test mode) **[manual]**

**Files:** none

**Prerequisite:** All previous tasks complete.

You will need: a real email address you can receive mail at (NOT one you use for the Stripe account), a Stripe test card number `4242 4242 4242 4242` (any future expiry, any 3-digit CVC).

- [ ] **Step 1: Free signup**

  1. Open https://deedscout.app in an **incognito** window.
  2. Click **Sign In** → switch to **Create account** tab.
  3. Sign up with a test email like `you+deedscout-test@gmail.com`.
  4. Check your email — Supabase sends a confirmation link. Click it.

  Expected: redirected back to the site, signed in. Top-right shows a "Account" pill instead of "Sign In."

  Common issue: confirmation email in spam. Check spam folder.

- [ ] **Step 2: Hit the free-tier paywall**

  1. From the registry, click a county (e.g. Orange).
  2. Click **Add to Research** five times across different parcels (or same parcel five times — limit is per-record, but five attempts should suffice).
  3. Try to add a 6th parcel.

  Expected: a confirm dialog appears: `Free tier is limited to 5 parcels. You currently have 5. Upgrade to Pro for unlimited cloud-synced watchlists?`

- [ ] **Step 3: Upgrade via Stripe Checkout**

  1. Click OK in the confirm dialog → navigates to `#/pricing`.
  2. Click **Upgrade to Pro**.
  3. Stripe Checkout opens. Enter:
     - Card: `4242 4242 4242 4242`
     - Expiry: any future date, e.g. `12 / 30`
     - CVC: `123`
     - ZIP: any 5 digits, e.g. `33101`
  4. Click **Subscribe**.

  Expected: redirected back to `https://deedscout.app/#/account?upgraded=1`. Account page shows status `Active`.

- [ ] **Step 4: Verify Supabase reflects the upgrade**

  Supabase dashboard → **Table Editor → profiles**. Find the row for your test user.

  Expected: `subscription_status = 'active'`, `stripe_subscription_id = 'sub_...'`, `stripe_customer_id = 'cus_...'`.

  If `subscription_status` is still `free`, the webhook didn't fire successfully. Debug:
  - Stripe dashboard → **Developers → Events** → find the `checkout.session.completed` event → check delivery status. If failed, open Netlify function logs.

- [ ] **Step 5: Access a Pro-only feature**

  Navigate to `https://deedscout.app/#/surplus-history`. Expected: loads without paywall. Empty state is fine (data depends on Workstream C).

- [ ] **Step 6: Cancel via Customer Portal**

  1. Navigate to `https://deedscout.app/#/account`.
  2. Click **Manage Subscription**. Stripe Customer Portal opens.
  3. Click **Cancel subscription** → confirm.
  4. Return to the site.

- [ ] **Step 7: Verify Supabase reflects cancellation**

  Refresh the Supabase `profiles` row. Expected: `subscription_status = 'canceled'`.

  Refresh `https://deedscout.app/#/account` — should show "Free" again. Surplus history should now show the paywall.

---

## Task 14: Verify RLS isolation **[manual]**

**Files:** none

**Why this matters:** The paywall lives in Postgres row-level security policies, not in client code. If RLS is misconfigured, a savvy free user could read paid data via the API directly. We must manually verify isolation before going live.

- [ ] **Step 1: Open the SQL Editor in Supabase**

  Supabase dashboard → **SQL Editor → New query**.

- [ ] **Step 2: Confirm RLS is on for all four tables**

  Run:

  ```sql
  select tablename, rowsecurity
  from pg_tables
  where schemaname = 'public'
    and tablename in ('profiles','watchlist_parcels','alert_subscriptions','surplus_history');
  ```

  Expected: all four rows show `rowsecurity = true`.

- [ ] **Step 3: Confirm there's at least one row of test surplus data**

  Run:

  ```sql
  insert into public.surplus_history (county, sale_date, parcel_id, surplus_amount, status)
  values ('Orange', '2025-12-01', 'TEST-RLS-CHECK', 5000.00, 'unclaimed')
  on conflict do nothing;

  select count(*) from public.surplus_history where parcel_id = 'TEST-RLS-CHECK';
  ```

  Expected: count = 1.

- [ ] **Step 4: Create a second free test user**

  Sign up at `https://deedscout.app` in another incognito window with a different email (e.g. `you+rls-test@gmail.com`). Confirm via email. Do **not** upgrade — this user must stay on the free tier.

- [ ] **Step 5: Try to read surplus history as a free user**

  Open DevTools console while signed in as the free test user. Run:

  ```javascript
  await window.supabase
    .from('surplus_history')
    .select('*')
    .eq('parcel_id', 'TEST-RLS-CHECK');
  ```

  Expected: `{ data: [], error: null }` — no rows returned. The query succeeds (no permission error) but RLS filters out all rows because this user isn't Pro.

  **Catastrophic failure:** if `data` contains the row, RLS is broken. Stop everything and audit `supabase/schema.sql` policies before launching.

- [ ] **Step 6: Try to read another user's watchlist**

  As the same free user, run in console:

  ```javascript
  await window.supabase.from('watchlist_parcels').select('*');
  ```

  Expected: an array of only this user's own parcels (empty if they haven't added any) — never another user's data.

- [ ] **Step 7: Clean up the test surplus row**

  Back in SQL Editor:

  ```sql
  delete from public.surplus_history where parcel_id = 'TEST-RLS-CHECK';
  ```

---

## Task 15: Flip Stripe to live mode **[manual]**

**Files:** none

**Prerequisite:** Tasks 13 and 14 pass. Stripe live mode requires identity verification (~10 minutes of form-filling with EIN/SSN, bank account).

- [ ] **Step 1: Activate Stripe live mode**

  Stripe dashboard → **Settings → Activate account** → complete the business identity verification flow. You'll need:
  - Legal business name (or your name for sole proprietorship)
  - EIN (or SSN if sole proprietor)
  - Business address
  - Bank account (routing + account number) for payouts
  - Public-facing details: website (`https://deedscout.app`), customer support contact

  Approval is usually instant for clean US sole-proprietor applications; can take 1–3 business days for entities.

- [ ] **Step 2: Recreate the Pro product in live mode**

  Toggle Stripe dashboard from **Test mode** to **Live mode** (top-left switch). Products and webhooks created in test mode **do not carry over** to live mode.

  Create the product:

  Stripe dashboard (live mode) → **Products → Add product**.
  - **Name:** `DeedScout Pro`
  - **Description:** `Pro subscription — unlimited research notebook, email alerts, and surplus-history lookups for Florida tax-deed investors.`
  - **Pricing model:** Standard pricing
  - **Price:** `29.00 USD`
  - **Billing period:** Monthly recurring
  - **Include tax:** off

  Click **Save product**. On the price detail page, capture the **Price ID** (`price_...` — note: this is a *new* live ID, different from the test one). Save to password manager as `STRIPE_PRICE_ID_PRO (live)`.

  Then capture the live secret key:

  Stripe dashboard → **Developers → API keys** → reveal **Secret key** (starts with `sk_live_`). Save as `STRIPE_SECRET_KEY (live)`.

- [ ] **Step 3: Recreate the webhook in live mode**

  Stripe dashboard (live mode) → **Developers → Webhooks → Add endpoint**.

  - **Endpoint URL:** `https://deedscout.app/api/stripe-webhook`
  - **Description:** `DeedScout subscription state sync (LIVE)`
  - **Listen to:** Events on your account
  - **Select events:** add exactly these six:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`

  Click **Add endpoint**. On the endpoint detail page, click **Reveal** next to **Signing secret**. Format: `whsec_...`. Save as `STRIPE_WEBHOOK_SECRET (live)`.

- [ ] **Step 4: Update Netlify env vars to live values**

  Netlify → **Environment variables** → edit:
  - `STRIPE_SECRET_KEY` → live secret (`sk_live_...`)
  - `STRIPE_PRICE_ID_PRO` → live price ID
  - `STRIPE_WEBHOOK_SECRET` → live webhook signing secret

  Trigger a redeploy.

---

## Task 16: Final go-live smoke test (live mode, real card) **[manual]**

**Files:** none

**Prerequisite:** Task 15 complete.

You will need: a real personal credit card (you'll charge yourself $29 and refund afterward).

- [ ] **Step 1: Repeat Task 13 against live mode with a real card**

  Run through Task 13 Steps 1–7 again, but this time use your real credit card in Stripe Checkout (not the test card).

  Expected: $29 actually charged. Subscription active. Supabase row shows `subscription_status = 'active'`.

- [ ] **Step 2: Issue yourself a refund**

  Stripe dashboard (live mode) → **Payments** → find the $29 charge → **Refund** → full refund.

  Stripe webhook fires `charge.refunded` (we don't listen for this, that's fine — the subscription stays active unless you cancel separately).

- [ ] **Step 3: Cancel the test subscription**

  Via Customer Portal on the live site → Cancel subscription. Verify Supabase row flips to `canceled`.

- [ ] **Step 4: Delete the test user (optional)**

  Supabase dashboard → **Authentication → Users** → delete your two test users so the production database starts clean.

- [ ] **Step 5: Announce**

  ```bash
  echo "DeedScout MVP is live at https://deedscout.app"
  ```

  Workstream B is done. Workstreams C (real auction data) and D (revenue funnel polish) are now unblocked.

---

## Done criteria summary

Per the spec, this workstream is done when:

1. ✅ `https://deedscout.app` resolves and serves the live registry over HTTPS — covered by Task 12.
2. ✅ A new user can sign up, confirm email, and add parcels — Task 13 Steps 1–2.
3. ✅ Free user paywall fires at the 6th parcel — Task 13 Step 2.
4. ✅ Stripe live-mode payment flips `subscription_status` to `active` within 30 seconds — Task 16 Step 1.
5. ✅ Cancellation flips it back to `canceled` within 30 seconds — Task 16 Step 3.
6. ✅ RLS blocks free users from reading `surplus_history` — Task 14 Step 5.
7. ✅ AVM and skip-trace UI are not visible — Task 7 Steps 5 and Task 10 Step 3.
