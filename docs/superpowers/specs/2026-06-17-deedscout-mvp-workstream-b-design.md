# DeedScout MVP — Workstream B: Provision real services

**Date:** 2026-06-17
**Status:** Approved — ready for implementation planning
**Scope:** One of four workstreams to take DeedScout from prototype to launchable product. This spec covers only "provision real services." Workstreams C (real auction data) and D (revenue funnel polish) are out of scope.

---

## Goal

Take the current `tax-deeds.html` from a placeholder-keyed prototype to a live, paying-customer-capable production deployment on `deedscout.app`. After this workstream is complete, a stranger could sign up, pay $29/mo for Pro, and have their subscription state correctly enforced by the backend.

## Locked-in inputs

| Item | Value | Rationale |
|---|---|---|
| Brand | DeedScout | Chosen from a shortlist of 8 directions; tool-feel name maps to the research-workstation positioning |
| Canonical domain | `deedscout.app` | `deedscout.com` is squatted; `.app` is HTTPS-by-default and modern-acceptable |
| Codebase | `tax-deeds.html` (legacy single-file site) | Vite cutover deferred — momentum is in the legacy file and shipping matters more than codebase hygiene at MVP |
| Pro features at MVP | Watchlists + email alerts + surplus history lookup | YAGNI — AVM and skip-trace exist in code but get hidden until launch settles |
| Pricing | $29/mo, monthly only, no trial | Easy-yes price, lowest funnel friction, simplest operations |
| Transactional email | Supabase default | Adequate for auth confirmations at MVP; upgrade to Resend/Postmark post-launch |

## Services & costs

| # | Service | Purpose | Plan | Cost |
|---|---|---|---|---|
| 1 | Supabase | Auth + Postgres + RLS | Free | $0/mo |
| 2 | Stripe | Subscription billing | Pay-as-you-go | ~2.9% + 30¢ per charge |
| 3 | Netlify | Static hosting + Functions | Free | $0/mo |
| 4 | Cloudflare Registrar | Domain registration | Annual | ~$15/yr |

Fixed cost at MVP: **~$15/year**. Stripe takes about $1.15 of each $29 Pro charge.

## Architecture

No architecture changes from the current prototype. All wiring already exists — this workstream is purely substituting real credentials for placeholders.

```
Browser (https://deedscout.app)
  │
  │  static assets
  ├──→ Netlify CDN
  │      └── tax-deeds.html  (loads Supabase JS via CDN)
  │
  │  authenticated reads/writes (RLS-guarded)
  ├──→ Supabase Postgres
  │      ├── profiles
  │      ├── watchlist_parcels
  │      ├── alert_subscriptions
  │      └── surplus_history
  │
  │  /api/checkout, /api/portal, /api/stripe-webhook
  └──→ Netlify Functions
         ├──→ Stripe API (server-side)
         └──→ Supabase service-role writes (subscription state)
```

## Task list (ordered)

Steps marked **[manual]** require the user clicking through a vendor dashboard. Steps marked **[code]** are repo changes.

1. **[manual]** Register `deedscout.app` at Cloudflare Registrar. Enable WHOIS privacy (free at Cloudflare).
2. **[manual]** Create a Supabase project named `deedscout-prod`. Capture:
   - Project URL (`https://xxxxx.supabase.co`)
   - `anon` key (safe to expose in client)
   - `service_role` key (server-side only — never commit)
3. **[manual]** In Supabase SQL Editor, run the existing `supabase/schema.sql`. Verify all tables created and RLS policies enabled.
4. **[manual]** Configure Supabase Auth:
   - Enable email/password provider
   - Set Site URL to `https://deedscout.app`
   - Set Email Confirmation redirect to `https://deedscout.app/#/account`
5. **[manual]** Create a Stripe account. Complete business profile. Stay in **test mode** for now.
6. **[manual]** In Stripe, create Product **"DeedScout Pro"** with a recurring monthly price of **$29.00 USD**. Capture the price ID (format: `price_xxxxxxxxxxxx`).
7. **[manual]** Connect Netlify to the GitHub repo `denrod25-del/test-snake`. Configure auto-deploy on push to `master`. Set publish directory to `.` (per existing `netlify.toml`).
8. **[manual]** In Netlify, set these environment variables:
   - `SUPABASE_URL` (public-safe but kept in env for consistency)
   - `SUPABASE_ANON_KEY` (public-safe)
   - `SUPABASE_SERVICE_KEY` (server-only — used by functions)
   - `STRIPE_SECRET_KEY` (test key, `sk_test_...`)
   - `STRIPE_PRICE_ID_PRO` (the price ID from step 6)
   - `STRIPE_WEBHOOK_SECRET` (set in step 10)
9. **[code]** Update `tax-deeds.html` lines ~17–22: replace `YOUR-PROJECT.supabase.co` and `YOUR_SUPABASE_ANON_KEY` placeholders with the real Supabase URL and anon key. Commit and push.
10. **[manual]** In the Stripe dashboard, add a webhook endpoint:
    - URL: `https://deedscout.app/api/stripe-webhook`
    - Events (must match what `netlify/functions/stripe-webhook.js` handles today):
      `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
    - Capture the signing secret (`whsec_...`) and put it in `STRIPE_WEBHOOK_SECRET` on Netlify.
11. **[manual]** DNS: in Cloudflare, point `deedscout.app` apex and `www.deedscout.app` at Netlify. Wait for Netlify to provision the Let's Encrypt cert (usually <5 min).
12. **[code]** In `tax-deeds.html`, add a `FEATURES` config object (default `{ advanced_lookups: false }`) and gate the AVM + skip-trace UI behind `FEATURES.advanced_lookups`. When the flag is false, those sections render as a "Coming soon" placeholder. Commit and push.
13. **[manual]** End-to-end smoke test with one real test account, in this order:
    1. Visit `https://deedscout.app`. See registry.
    2. Sign up with a real email. Confirm via the link in the email.
    3. Add 5 parcels to Research Notebook. The 6th attempt should hit the free-tier paywall and prompt upgrade.
    4. Click Upgrade. Go through Stripe Checkout using test card `4242 4242 4242 4242`.
    5. After redirect, verify the account page shows `Pro`.
    6. In Supabase Studio, verify `profiles.subscription_status` is `active` (or `trialing`) for that user, and `profiles.stripe_subscription_id` is populated.
    7. Open the Surplus History page. Should load with an empty-state message (data comes in workstream C).
    8. Click "Manage Subscription" → Stripe Customer Portal → Cancel subscription.
    9. After redirect, verify the account page shows `Free`.
    10. Verify `profiles.subscription_status` is `canceled` in Supabase (the RLS policies treat anything outside `active`/`trialing` as free).
14. **[manual]** Once smoke tests pass: in Stripe, flip from test to live mode. In Netlify, replace `sk_test_...` with `sk_live_...`. Recreate the webhook endpoint in live mode and rotate `STRIPE_WEBHOOK_SECRET`.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stripe webhook signature verification fails (raw body mangled) | Low — already handled in `netlify.toml`'s `[functions."stripe-webhook"]` block. Re-verify after first webhook fires in test mode. | Re-verify manually during smoke test step 13.4 |
| RLS policy missed for a Pro-only table — free user can read paid data | Medium — RLS bugs are silent | After step 3, manually test: sign in as a free user via Supabase Studio's auth-as-user mode and confirm `select` from `surplus_history` returns nothing. Repeat after every schema change. |
| Auth confirmation emails go to spam (Supabase default sender) | High — generic `noreply@mail.supabase.io` triggers spam filters | Show "Didn't get the email? Check spam, or [resend]" hint on the confirm-pending page. Schedule Resend integration for post-MVP. |
| `.app` HSTS preload breaks the site if HTTPS misconfigured | Low | Netlify provisions Let's Encrypt automatically. Don't ship until cert is green. |
| Wrong Stripe price ID in env → checkout fails | Low — easy to spot in smoke test | Smoke test step 13.4 catches it. |
| Service-role key accidentally committed | Catastrophic if it happens | `.env.local` is gitignored; keys only set in Netlify dashboard; double-check `git status` before every push. |

## Out of scope for this workstream

- Real auction data populating `sales.json` — **workstream C**
- Marketing landing copy / signup-conversion UX polish — **workstream D**
- Vite app cutover — deferred indefinitely
- AVM + skip-trace as paying features — post-MVP
- Custom transactional email branding (Resend/Postmark) — post-MVP
- Annual billing option — post-MVP
- Free trial — post-MVP

## Success criteria

This workstream is **done** when:

1. `https://deedscout.app` resolves and serves the live registry over HTTPS.
2. A new user can sign up, confirm email, and add parcels to a research notebook.
3. A free user hitting the parcel limit gets paywalled into the upgrade flow.
4. A user completing Stripe Checkout in **live mode** has their `profiles.subscription_status` set to `active` (and `stripe_subscription_id` populated) within 30 seconds of the webhook firing.
5. A user cancelling via the portal has their `profiles.subscription_status` set to `canceled` within 30 seconds.
6. RLS prevents a free user from reading any row of `surplus_history`.
7. The AVM and skip-trace UI are not visible at `deedscout.app`.
