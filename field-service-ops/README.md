# Field Service Ops

Multi-tenant field-service app for plumbing, HVAC, and electrical shops.

**Loop:** Book → Dispatch → Job → collect payment on-site (tech mobile web).

Working title brand: **Field Service Ops** (final public name TBD).

## Quick start (demo mode)

Demo mode runs with no Supabase/Stripe keys — data stays in `localStorage`.

```bash
cd field-service-ops
npm install
npm run dev
```

Open **http://localhost:5173/**

Demo logins:

- `owner@dogfood.local` — owner/CSR/dispatcher/tech for Dogfood shop
- `tech@dogfood.local` — tech only

Public request form: **http://localhost:5173/r/dogfood**

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest unit/handler tests |
| `npm run preview` | Serve `dist/` |

## Production setup

1. Create a **dedicated** Supabase project (do not reuse DeedScout).
2. Apply `supabase/migrations/20260912_fso_core.sql` (or `supabase/schema.sql`).
3. Set env for the SPA: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Create a **separate Netlify site** with base directory `field-service-ops` (or publish `field-service-ops/dist` with functions from `field-service-ops/netlify/functions`).
5. Netlify function env (FSO site):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `SPI_KEY_ENCRYPTION_SECRET`, `PUBLIC_SITE_URL`
   - optional `SPI_BASE_URL` (default `https://deedscout.app`)
6. Stripe Connect Express platform settings + webhook for **connected account** `payment_intent.*` events → `/api/stripe-connect-webhook`.
7. Issue a DeedScout SPI shop key (`scripts/issue-shop-api-key.mjs` in repo root) and store it via owner `POST /api/set-spi-key` `{ shopId, spiKey }` (AES-GCM ciphertext in `shop_spi_secrets`, service-role only).

### Wired API routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/create-payment-intent` | JWT + member | Direct PI on connected account |
| `POST /api/create-connect-account` | JWT + owner | Express Account Link |
| `POST /api/stripe-connect-webhook` | Stripe signature | Mark payments / job payment_status |
| `POST /api/create-public-request` | none (rate-limited) | RPC `submit_public_request` by slug |
| `POST /api/property-briefing` | JWT + member | Proxy to DeedScout SPI |
| `POST /api/set-spi-key` | JWT + owner | Store encrypted SPI key |
| `POST /api/invite-member` | JWT + owner | Admin createUser + membership |

## Architecture notes

- Vite + React + TypeScript SPA; React Router browser history.
- Netlify `/api/*` redirects are declared **before** the SPA `/*` fallback in `netlify.toml`.
- Payments: Stripe Connect **direct charges** on the connected account + Payment Element.
- SPI: authenticated FSO proxy → `https://deedscout.app/api/property` (never expose the SPI key to the browser).

## Out of scope (v1)

Memberships, marketing, payroll, QuickBooks sync, inventory, native apps, fleet/GPS.
