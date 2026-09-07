# Enable paid research APIs (BatchData + RentCast)

DeedScout’s Pro skip-trace and AVM panels are **already built**. They stay dark until two Netlify environment variables are set, then you redeploy.

| Feature | Env var | Vendor |
|---------|---------|--------|
| Skip-trace (phones / emails) | `BATCHDATA_API_TOKEN` | [BatchData](https://batchdata.com) |
| AVM + rent estimates | `RENTCAST_API_KEY` | [RentCast](https://app.rentcast.io) |

Optional: `BATCHDATA_BASE_URL` (default `https://api.batchdata.com`), `RENTCAST_BASE_URL` (default `https://api.rentcast.io`), `PRO_SKIP_TRACE_GRANT` (default `50`), `PRO_AVM_GRANT` (default `200`).

---

## 1. Get a RentCast key (start here — free tier)

1. Open https://app.rentcast.io and create an account.
2. Go to **API** → create / copy an API key.
3. Free tier (~50 calls/mo) is enough to smoke-test AVM + rent.

## 2. Get a BatchData token

1. Open https://batchdata.com and sign up (Pay-as-you-go is fine; ~$0.05/skip).
2. In the dashboard: **API → Tokens** → create a token.
3. Copy the Bearer token (you will paste it as `BATCHDATA_API_TOKEN`).

## 3. Add both keys in Netlify

1. Open https://app.netlify.com → site **deedscout** (or your DeedScout site).
2. **Site configuration → Environment variables → Add a variable**.
3. Add (Production context — and Preview if you want deploy previews to work too):

   - `RENTCAST_API_KEY` = your RentCast key  
   - `BATCHDATA_API_TOKEN` = your BatchData token  

4. **Deploys → Trigger deploy → Clear cache and deploy site**  
   Env changes do **not** apply until a new deploy finishes.

## 4. Confirm credits exist in Supabase

In Supabase → **SQL Editor**, if Pro accounts show 0/0 credits, run:

- `supabase/migrations/20260419_data_credits_and_caches.sql` (if never applied)
- then, if needed, `supabase/migrations/20260712_heal_zero_credit_buckets.sql`

Stripe webhook must include `invoice.payment_succeeded` so monthly grants refill.

## 5. Smoke-test on production only

Use **https://deedscout.app/** (not a deploy preview):

1. Sign in with a **Pro** account.
2. Tax Deeds → open a parcel with owner + address → **Skip-trace** and **Estimate ARV**.
3. Property Intelligence → **Estimate rent** on a wired county parcel.

Expected when keys are live:

- Skip-trace returns phones/emails (or an honest “no match”) and decrements skip-trace credits (cache hits are free for ~90 days).
- AVM returns a value + comps and decrements AVM credits (cache ~30 days).

Expected when a key is still missing:

- HTTP **503** `vendor_not_configured` with a clear message.
- **No credit spent** (fail-fast before the vendor call).

`POST /api/credits` also returns:

```json
"vendors": { "skip_trace": true, "avm": true }
```

so you can confirm configuration without exposing secrets.

## 6. After it works

Optional copy polish on `pricing.html` / Tax Deeds pricing foot: change “need vendor API keys on Netlify” to “live for Pro” once both vendor flags are true in production.
