# Plausible conversion funnel

DeedScout already sends these browser events:

| Event | Where it fires |
|---|---|
| `county_view` | County index links (`counties/index.html`) |
| `signup_start` | Homepage free CTAs |
| `pro_intent` | Homepage / closing Pro CTAs |
| `pro_intent_pricing` | Pricing page Upgrade button |
| `digest_signup` | Weekly digest submit |
| `checkout_success` | `tax-deeds.html` when Stripe returns `checkout=success` (once per browser session) |

## Build the funnel in Plausible

1. Open https://plausible.io/deedscout.app
2. **Goals** → add a custom event for each name above (exact spelling).
3. **Funnels** → **New funnel** → name it `County to Pro`.
4. Steps, in order:
   1. `county_view`
   2. `pro_intent`
   3. `checkout_success`
5. Save.

Optional second funnel for homepage traffic:

1. `signup_start`
2. `pro_intent`
3. `checkout_success`

Also track `pro_intent_pricing` as its own goal if you want pricing-page intent separate from homepage intent.

## Sanity check

- Click a county on https://deedscout.app/counties/ → `county_view` increments.
- Click **Pro · $49/mo** on the homepage → `pro_intent` increments.
- Complete a Stripe checkout (live or test mode) and land back on Tax Deeds with `checkout=success` → `checkout_success` increments once.

Pageviews already flow from the site script `pa-W5hLWZYnOYQ6KHHQAhUDL.js`.
