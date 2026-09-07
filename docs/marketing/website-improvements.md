# DeedScout website improvement spec

Prepared for implementation in Cursor. Every item below references a real file and
a real string in this repo. Work top to bottom: P0 items block the value of
everything after them.

**Scope:** marketing surfaces only (`index.html`, `pricing.html`, `counties/*.html`,
`assets/deedscout.js`). Do not change scraper logic, Supabase schema, or the
in-app trust labelling in `assets/data-trust.js`.

**Copy rules for all new text:**
- No em-dashes. Use periods, commas, or the site's existing `·` separator.
- No "unlock", "seamless", "powerful", "game-changer", "revolutionize".
- Lead with what the reader loses by not having it, not with what the tool contains.
- Never claim coverage the data does not support. Numbers below are pulled from
  the repo and must be regenerated, not hardcoded, wherever a build step allows.

---

## P0-1. The homepage redirect is discarding every tagged visitor

**File:** `index.html`, lines 28-34.

```html
<script>
  (function () {
    var q = window.location.search || "";
    var h = window.location.hash || "";
    if (q || h) window.location.replace("tax-deeds.html" + q + h);
  })();
</script>
```

Any URL carrying a query string or hash is bounced straight to `tax-deeds.html`.
That means `deedscout.app/?utm_source=newsletter`, `deedscout.app/?fbclid=...`,
`deedscout.app/?gclid=...` and every link a marketing tool decorates never render
the homepage. As written, the homepage cannot be the landing page for any paid
ad, any tracked email, or any social post that appends parameters. Referrer data
is also destroyed because `replace()` leaves no history entry.

This single line is worth more than every copy change in this document.

**Fix:** only redirect on the legacy deep-link params this rule was written for.
Replace the block with:

```html
<script>
  (function () {
    var q = window.location.search || "";
    var h = window.location.hash || "";
    // Legacy deep links into the Tax Deeds SPA. Marketing params must not redirect.
    var LEGACY = /(^|[?&])(county|parcel|sale|view|tab)=/i;
    var isLegacyHash = h && h.length > 1 && h !== "#";
    if ((q && LEGACY.test(q)) || isLegacyHash) {
      window.location.replace("tax-deeds.html" + q + h);
    }
  })();
</script>
```

**Acceptance criteria:**
- `deedscout.app/?utm_source=test&utm_medium=email` renders the homepage.
- `deedscout.app/?fbclid=abc123` renders the homepage.
- `deedscout.app/?county=broward` still redirects to `tax-deeds.html?county=broward`.
- `deedscout.app/#/pricing` still redirects.

Confirm no other page carries the same pattern:
`grep -rn "location.replace" *.html counties/*.html learn/*.html`

---

## P0-2. There is no analytics on the site

Verified: no GA4, no Plausible, no PostHog, no pixel, no tag manager on any page.
`Facebook Pixel` appears only as prose in `privacy.html`; `clarity` only as prose
in `changelog.html`. Nothing is installed.

Consequence: you cannot tell which of the 67 county pages earns traffic, which
one converts, or whether any change in this document worked.

**Fix:** add Plausible (cookieless, keeps the existing privacy stance intact, and
`privacy.html` needs almost no rewrite).

Add to `<head>` of every marketing page (`index.html`, `pricing.html`,
`tax-deeds.html`, `counties/*.html`, `learn/*.html`, `about.html`, `faq.html`,
`trust.html`, `methodology.html`, `data-sources.html`, `status.html`):

```html
<script defer data-domain="deedscout.app" src="https://plausible.io/js/script.tagged-events.outbound-links.js"></script>
```

Since `counties/*.html` are generated, add the tag to the generator template in
`scripts/` rather than to the 67 output files, then regenerate.

**Custom events to fire.** Add `class="plausible-event-name=..."` to these
existing elements:

| Element | File | Event name |
|---|---|---|
| `Start Free` buttons (3 of them) | `index.html` L48, L204 | `signup_start` |
| `Upgrade to Pro` buttons (3) | `index.html` L49, L143, L205 | `pro_intent` |
| `Upgrade to Pro` on pricing | `pricing.html` | `pro_intent_pricing` |
| Digest form submit | `index.html` L~235 | `digest_signup` |
| Any `View county` link | `counties/index.html` | `county_view` |

Then in Plausible set up one funnel: `county_view` to `pro_intent` to Stripe success.

**Also required:**
- Register `deedscout.app` in Google Search Console and submit `sitemap.xml`
  (87 URLs already listed).
- Add `<meta name="referrer" content="strict-origin-when-cross-origin">` so
  outbound clicks to clerk sites keep attribution.
- Update `privacy.html` to name Plausible and state that it sets no cookies and
  collects no personal data.

**Acceptance:** a real visit shows in Plausible, and `signup_start` fires on click.

---

## P0-3. Nothing ranks for the brand name

Searching "DeedScout" returns a volunteering app and a UX research tool. No
DeedScout result on page one.

**Fix in `index.html`:**

1. `<title>` currently reads:
   `DeedScout — Florida Tax Deed Research, County by County`
   Change to:
   `DeedScout · Florida Tax Deed Sale Calendar and Parcel Research`

2. `<h1>` is currently the bare word `DeedScout` (L43). A one-word H1 gives Google
   nothing. See P1-1 for the replacement.

3. Extend the existing `SoftwareApplication` JSON-LD block (L13-27) with an
   `Organization` graph node so the brand has an entity to attach to:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "DeedScout",
  "url": "https://deedscout.app/",
  "description": "Florida tax deed sale calendar and public-records research tool for investors.",
  "areaServed": { "@type": "State", "name": "Florida" },
  "sameAs": []
}
```

Populate `sameAs` with your real social profiles once they exist. Claiming the
handle on two or three platforms and linking them here is the fastest path to
owning the branded result.

---

## P1-1. Rewrite the hero: sell the missed deadline, not the filing cabinet

**File:** `index.html`, lines 39-60.

Current lede sells organization: *"Florida tax deed research, organized county by
county"*. Nobody pays $49 a month to be organized. Florida tax deed bidders have
one recurring fear that costs real money: a sale date passes in a county they
wanted and they find out afterwards.

**Replace lines 41-52 with:**

```html
      <div>
        <p class="ds-hero-eyebrow">Florida tax deed investors</p>
        <h1>Never miss a Florida tax deed sale again</h1>
        <p class="ds-hero-lede">
          67 counties. One calendar. Upcoming auction dates pulled from the clerks
          and auction platforms, with email alerts before every sale and a link
          to the official source for every date we show.
        </p>
        <div class="ds-hero-ctas">
          <a class="ds-btn ds-btn-primary plausible-event-name=signup_start" href="tax-deeds.html">See upcoming sales free</a>
          <a class="ds-btn ds-btn-secondary plausible-event-name=pro_intent" href="pricing.html">Pro · $49/mo</a>
        </div>
        <p class="ds-hero-tagline">Every date links to the official clerk or auction source · <a href="counties/index.html">Browse 67 counties</a> · <a href="pricing.html">Compare Free vs Pro</a></p>
      </div>
```

Three deliberate changes beyond the wording:

- **"Public Beta" is removed from the eyebrow.** It sits directly above the buy
  button and gives a hesitant buyer a reason to wait. Keep the beta status on
  `trust.html` and `status.html` where a buyer goes to check you out.
- **Primary CTA is now "See upcoming sales free"** instead of "Start Free".
  It names the thing they get.
- **Pricing links now point to `pricing.html`.** Currently the hero button goes to
  `tax-deeds.html#/pricing` while the tagline goes to `pricing.html`. Two
  destinations for the same intent splits your conversion data and one of them
  is inside the SPA where analytics is harder. Standardise on `pricing.html`
  across L49, L143, and L205.

---

## P1-2. The hero stats undersell you

**File:** `index.html`, lines 53-58.

Current: `67 Counties indexed`, `4 Cached permit cities`, `6 Research modules`,
`1 Workflow`.

"6 Research modules" and "1 Workflow" are internal vocabulary. "4 Cached permit
cities" advertises your thinnest dataset in your most prominent slot. Meanwhile
the genuinely impressive fact, that you are tracking 106 real upcoming sale dates
across 33 counties, appears nowhere on the homepage.

**Replace with:**

```html
      <div class="ds-hero-stats">
        <div class="ds-stat"><div class="val">67</div><div class="lbl">Florida counties</div></div>
        <div class="ds-stat"><div class="val">106</div><div class="lbl">Upcoming sales tracked</div></div>
        <div class="ds-stat"><div class="val">33</div><div class="lbl">Counties with live dates</div></div>
        <div class="ds-stat"><div class="val">Sep 7</div><div class="lbl">Last refresh</div></div>
      </div>
```

**These must be generated, not hardcoded.** `sales.json` already carries
everything needed at its top level:

```json
{ "generated": "2026-09-07T07:02:57Z", "stats": { "scraped": 32, "manual": 0, "curated": 1, "failed": 1, "skipped": 9 }, "sales": { ... } }
```

Counties with dates = `Object.keys(sales).length` (33). Total sale events = sum of
each county array length (106). Last refresh = `generated`.

Have the same script in `scripts/` that already writes `sales.json` also write
these four values into the homepage, or render them client-side from `sales.json`
on load. A stale hardcoded "Last refresh" is worse than showing none, and it
contradicts the trust posture the rest of the site is built on.

---

## P1-3. Take the roadmap off the pricing page

**File:** `pricing.html`.

Across the marketing pages there are 24 instances of "coming soon" and 33 of
"sample". On `pricing.html` specifically, every tier including the free one
carries a `Coming soon` row, and the Pro tier carries both `Beta` and
`Coming soon` rows directly beneath its buy button (L65-67).

The Live / Cached / Sample / Blocked / Broken labelling is the best thing about
this product and it should stay everywhere it helps a user judge a data point.
A pricing page is not that place. There, the same words simply tell a buyer to
come back later.

**Changes:**

1. **Delete these lines entirely:**
   - L45 `<div class="ds-pricing-live"><strong>Coming soon</strong>Full 67-county GIS coverage</div>`
   - L67 `<div class="ds-pricing-live"><strong>Coming soon</strong>Carrier insurance rate-shift feeds · Investor Pro checkout · Multi-county dashboard polish</div>`
   - L85 and L101 (both `Coming soon` rows on the two unbuyable tiers, which P1-4 removes anyway)

2. **Keep and reword L66** (the `Beta` row on Pro). Sale alerts genuinely depend
   on the scraper finding dates, and a buyer needs to know that before paying.
   Reword from a hedge into a specification:

```html
<div class="ds-pricing-live"><strong>Alert coverage</strong>Alerts fire for the 33 counties where we currently scrape live dates. The other 34 counties show official clerk links only.</div>
```

That is more honest than "Beta" and it reads as precision rather than as an
unfinished feature.

3. **Rewrite the page subhead, L22.** Currently:
   *"Every tier separates Live today from Coming soon. DeedScout is a public paid beta — not final investment-data authority."*

   Replace with:
   ```html
   <p>County records are free. Knowing when every sale happens, in one place, is what you are paying for. <a href="trust.html">See exactly where each dataset comes from</a>.</p>
   ```

   The beta disclosure moves to `trust.html`, which is linked right there.

4. **Keep L26 (the pre-checkout legal block) exactly as it is.** That one is
   doing real work and belongs above a buy button.

---

## P1-4. Cut the pricing ladder from four tiers to two

**File:** `pricing.html`, tiers at L73-86 (Investor Pro) and L90-102 (Team).

You currently show four tiers where two cannot be bought. Investor Pro is
waitlist-only with credits described as "planned". Team is "Contact sales" with
API access and SSO listed as "coming soon". Showing two unbuyable tiers makes the
one buyable tier look provisional.

**Changes:**

1. Delete the Investor Pro tier block (L73-86) and the Team tier block (L90-102).
2. Below the two remaining cards, add a single line:

```html
<p class="ds-pricing-footnote">
  Running higher volume, or need multiple seats?
  <a href="contact.html">Tell me what you need</a> and I will quote it.
</p>
```

3. Update the FAQ JSON-LD at L13, which currently states
   *"Investor Pro bundle UI and sale-date automation are still maturing"*.
   Replace the whole `acceptedAnswer` text with:
   *"The 67-county directory, permit search, multi-county parcel lookup, and Property Intelligence are free. Pro adds watchlists, email alerts, saved parcels, CSV export, bid calculator, AVM, rent comps, and skip trace, billed through Stripe with cancellation any time."*

4. Grep for stale references to the removed tiers before finishing:
   `grep -rn "Investor Pro" *.html assets/*.js`

Keeping the waitlist itself is fine. It just should not occupy a pricing card.

---

## P1-5. Give the price something to be compared against

**File:** `pricing.html`, inside the Pro tier, directly above the Upgrade button.

$49 a month is currently presented with nothing to weigh it against. For this
buyer the comparison is trivially favourable and it should be stated:

```html
<div class="ds-pricing-anchor">
  A single missed sale date costs more than a year of Pro.
  At a $10,000 bid, Pro is about half of one percent of one deal.
</div>
```

Style it as a quiet aside, not a shouted banner. Add the matching `.ds-pricing-anchor`
rule to `assets/deedscout.css` alongside the existing `.ds-pricing-live` styles.

---

## P1-6. Rewrite the closing CTA

**File:** `index.html`, lines 199-207.

Current: *"Ready to organize your next sale?"* and *"Start free on the 67-county
directory, then unlock Pro watchlists, alerts, and CSV export when you need the
workflow."* Same organization framing as the hero, plus "unlock".

**Replace the `<h2>` and `<p>` with:**

```html
      <h2>Which counties are you bidding in?</h2>
      <p>Browse all 67 free. When you are watching more than one county, Pro sends you the sale dates before they pass.</p>
```

Update both buttons to match P1-1 (label, `pricing.html` destination, Plausible
event class).

---

## P2-1. The county pages are your best asset and the thinnest built

67 generated pages at `counties/*.html`, already in `sitemap.xml`. "Broward county
tax deed sale" is close to exactly what this buyer types into Google. These pages
should be the top of the funnel and currently they are link lists.

**Per-page additions, in the generator template, not the output files:**

1. **The next sale date as an H2, above the fold**, for the 33 counties where
   `sales.json` has one. This is the query intent. Include the parcel count and
   the `officialUrl` link that is already in the data:

```html
<h2>Next Broward County tax deed sale: October 26, 2026</h2>
<p>14 parcels scheduled. <a href="[officialUrl]" rel="nofollow noopener" target="_blank">Verify on the official auction site</a> before bidding.</p>
```

2. **For the 34 counties without a scraped date**, do not leave the slot empty and
   do not fake it. Write:

```html
<h2>Broward County tax deed sales</h2>
<p>We do not yet scrape live dates for this county. Check the official clerk link below, or <a href="/pricing.html">get an alert</a> when we add it.</p>
```

That converts a coverage gap into an email capture.

3. **A single email capture per page**, county-scoped: "Email me before the next
   [County] sale." One field. This is the highest-intent moment on the entire
   site and there is currently no capture on these pages at all.

4. **`FAQPage` JSON-LD per county** answering "When is the next tax deed sale in
   [County]?" and "Where are [County] tax deed sales held?". These are the two
   real queries and structured data is how you win the snippet.

5. **Internal links** from each county page to the relevant `learn/` article.
   You have 5 good articles that almost nothing links to.

---

## P2-2. Test the surplus funds audience

Florida surplus funds recovery is an active industry, and those operators have
much higher revenue per deal than a bidder does. You already have the three
things they need: sale results by county, surplus portal links, and BatchData
skip trace wired into Pro.

Right now that audience gets one page
(`florida-surplus-funds-by-county.html`, 1.7KB) and one learn article.

**Build one proper landing page** at `/florida-surplus-funds/` targeting
"florida tax deed surplus funds" and "[county] surplus funds list", covering:
which counties publish surplus lists and where, the claim deadline per county,
and how DeedScout's skip trace helps locate the prior owner. Same email capture
pattern as the county pages.

Treat this as a test, not a pivot. If it out-converts the bidder pages per visit,
it changes what we build next quarter.

---

## P2-3. Two smaller fixes on the digest form

**File:** `index.html`, lines ~229-245.

1. **The example digest currently advertises a data gap.** The sample preview ends
   with *"Reminder: PBC unincorporated permits are SAMPLE only in DeedScout."*
   The purpose of a sample is to show the product at its best. Replace that line
   with a real signal:
   ```
   Broward: next sale Oct 26 · 14 parcels
   ```

2. **Drop the Name field.** Three required fields for a newsletter is two too
   many. Keep Email and Primary interest. The interest dropdown is worth keeping
   because it segments bidders from surplus operators, which directly feeds the
   P2-2 test. Confirm the Netlify form still validates after the field is removed.

---

## Suggested order of work

| Order | Item | Effort | Why here |
|---|---|---|---|
| 1 | P0-1 redirect | 15 min | Every tagged visitor is currently lost |
| 2 | P0-2 analytics | 1 hr | Nothing after this is measurable without it |
| 3 | P0-3 brand schema | 30 min | Slow to take effect, so start it early |
| 4 | P1-1, P1-2 hero | 1 hr | Highest-traffic copy on the site |
| 5 | P1-3, P1-4, P1-5 pricing | 1 hr | Directly in front of the buy button |
| 6 | P1-6 closing CTA | 15 min | Consistency with the new hero |
| 7 | P2-1 county pages | 1 day | Biggest long-term upside |
| 8 | P2-2 surplus page | half day | Audience test |
| 9 | P2-3 form | 20 min | Cleanup |

## Do not change

- The trust label system in `assets/data-trust.js` and its in-app rendering.
- `trust.html`, `methodology.html`, `data-sources.html`, `status.html`. These
  pages are the reason a careful buyer trusts you. They should stay exactly as
  detailed as they are.
- The pre-checkout legal disclosure on `pricing.html` L26.
- The site-wide disclaimer section on `index.html`.
- Any scraper, Supabase migration, or Stripe integration code.

## How to tell if this worked

Two weeks after P0 ships, you should be able to answer all of these. Today you
cannot answer any of them.

- How many people hit the homepage, and how many reach `pricing.html`?
- Which five county pages get the most traffic?
- What percentage of county page visitors click through to pricing?
- Does the new hero convert better than the old one? Run it as an A/B test if
  traffic supports it, or as a clean before-and-after if it does not.
