# Florida booking records + pre-moderated comments — Design spec

**Status:** Approved by product owner (2026-05-02).  
**Related plan:** `docs/superpowers/plans/2026-05-02-florida-booking-aggregator.md`

## 1. Problem and goals

Build a web application that:

- Ingests public booking / in-custody data from **three Florida counties** (Orange, Miami-Dade, Palm Beach) via **per-county adapters**.
- Refreshes data on a **daily** schedule where automation is technically and legally viable.
- Presents searchable **records** with **mugshots** (official URL and/or cached copy per policy).
- Allows **signed-in users** to **comment** on a record; comments use **pre-moderation** (only `approved` comments are public).
- Links prominently to **official sources** and disclaimers.

Non-goals for v1:

- Covering all 67 Florida counties.
- Bypassing CAPTCHA, rate limits, or site terms of use.
- Legal advice or guaranteed record accuracy.

## 2. Constraints and compliance

- Each public portal’s **terms of use**, **robots.txt**, and **acceptable use** must be reviewed before production automation. Adapters run with conservative rate limits and clear logging.
- **Palm Beach County** ([PBSO booking blotter](https://www3.pbso.org/blotter/)) advertises bot verification (“verify you are not a robot”). If unattended fetches fail or are disallowed, v1 must support **degraded modes**: e.g. manual CSV import, or “stale” badge with last successful sync — **not** CAPTCHA circumvention.
- **Arrest display:** Prominent copy that an arrest is not a conviction; information may be wrong or outdated; users should verify with the official agency.

## 3. User roles

| Role | Capabilities |
|------|----------------|
| **Visitor** | Browse/search records, view detail pages, read **approved** comments. |
| **Signed-in user** | Submit comments (stored as `pending`). |
| **Admin** | Approve/reject pending comments; optional future: mark records hidden, view sync logs. |

Admin access in v1: protect routes with an **environment allowlist** of user IDs/emails from the auth provider, or a dedicated `role` column — single org is enough.

## 4. Data model (conceptual)

### 4.1 BookingRecord (normalized)

- `id` (internal UUID)
- `county` — enum or string: `ORANGE` | `MIAMI_DADE` | `PALM_BEACH`
- `source_system` — short slug (e.g. `ocfl_bestjail`, `mdcr`, `pbso_blotter`)
- `external_id` — string unique within county+source (booking number, JMS id, composite key serialized)
- `person_name` — display name (structured fields optional: last, first, middle)
- `booking_date` — nullable timestamp
- `charges_text` or normalized charge rows (v1: text blob + optional JSON snapshot is acceptable)
- `mugshot_url` — nullable; official URL when hotlinking is permitted
- `mugshot_storage_key` — nullable; if caching images to object storage
- `official_source_url` — deep link to view on agency site where possible
- `raw_metadata` — JSON for adapter debugging (trim in production if needed)
- `first_seen_at`, `last_seen_at`, `last_synced_at`
- Unique constraint: (`county`, `source_system`, `external_id`)

### 4.2 Comment

- `id`
- `booking_record_id` (FK)
- `author_user_id` (from auth)
- `body` — plain text, length cap, sanitized (no HTML)
- `status` — `pending` | `approved` | `rejected`
- `moderated_by_user_id` — nullable
- `moderated_at` — nullable
- `created_at`

Only `approved` comments appear on public pages.

### 4.3 Optional: SyncRun

- `id`, `started_at`, `finished_at`, `county`, `status`, `error_message`, `records_upserted`

## 5. Architecture

- **App:** Next.js (App Router), TypeScript.
- **Database:** PostgreSQL (e.g. Neon, Supabase, or self-hosted).
- **ORM:** Prisma recommended.
- **Auth:** Auth.js (NextAuth v5) with at least one OAuth provider (e.g. Google) and/or email magic link.
- **Jobs:** Vercel Cron or external scheduler hitting a **secret-protected** API route `POST /api/cron/sync` (or per-county steps).
- **Storage:** Optional S3-compatible bucket for mugshot caching; v1 may use **URL-only** display if caching is deferred.

**County adapters:** Each exports a common interface, e.g. `syncCounty(ctx): Promise<NormalizedBooking[]>`. The orchestrator upserts into `BookingRecord`.

## 6. UX (v1)

- **Home:** Search by county, name fragment, date range (where data supports it).
- **Detail:** Photo, core fields, charges summary, link “View official record,” disclaimer, **comment form** (if signed in), list of **approved** comments with timestamps.
- **Admin:** `/admin/comments` queue: pending items with approve/reject; show record snippet and author.

## 7. Security

- Rate limit comment creation (per user / IP).
- CSRF protection via Next.js/Auth.js patterns.
- Cron route: `Authorization: Bearer <CRON_SECRET>` or Vercel Cron headers only.
- Input sanitization for comment body (strip HTML, max length).

## 8. Testing (v1 bar)

- Unit tests for normalization and dedupe keys.
- Integration tests against **fixtures** (saved HTML/JSON snapshots), not live agency sites in CI.
- Smoke test: auth + submit pending comment + admin approve appears on detail page.

## 9. Open decisions (implementation phase)

- Exact auth providers (Google-only vs Google + email).
- Whether v1 caches mugshots or uses official URLs only (impacts cost and ToS).
- Palm Beach: adapter vs import-only for launch — **decide after** reading PBSO terms and a prototype fetch.

## 10. Self-review checklist

- [x] No contradiction with “pre-moderation” and “sign-in required.”
- [x] Palm Beach CAPTCHA called out with non-bypass policy.
- [x] Scope limited to three named counties.
- [x] Admin moderation path specified.
