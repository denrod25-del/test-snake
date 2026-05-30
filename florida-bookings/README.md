# Florida booking aggregator

Next.js app that stores normalized booking rows from Florida county public portals (adapters for **Orange**, **Miami-Dade**, **Palm Beach**) and hosts **sign-in-only** comments with **pre-moderation**.

## Quick start

1. Create a PostgreSQL database and set env vars. **Important:** this app uses the `pg` driver, so runtime needs a normal **`postgresql://...`** string. If `prisma dev` gives you `prisma+postgres://...`, put the **direct** Postgres URL in **`DIRECT_DATABASE_URL`** (or replace `DATABASE_URL` with `postgresql://` for both CLI and app).
2. Copy `.env.example` to `.env` and fill secrets.
3. Apply schema:

```bash
npx prisma migrate deploy
```

4. **Local dev sign-in:** With no Google OAuth env vars, development uses a **Dev sign-in** provider: enter any valid email on the sign-in form.

5. **Optional demo data:** Set `SYNC_USE_FIXTURES=true`, then:

```bash
curl -X POST http://localhost:3000/api/cron/sync -H "Authorization: Bearer YOUR_CRON_SECRET"
```

6. Run the app:

```bash
npm install
npm run dev
```

Set `ADMIN_EMAILS` (comma-separated) to the email(s) allowed to open **`/admin/comments`** and approve comments. The Moderation link is shown to any signed-in user; non-admins are redirected away from `/admin/*`.

### Auth.js “server configuration” / Configuration error

Usually **`AUTH_SECRET` is missing**. Auth.js needs it to encrypt session cookies ([MissingSecret](https://errors.authjs.dev#missingsecret)).

- Add to `.env`: `AUTH_SECRET` — generate with `npx auth secret` or `openssl rand -base64 32`.
- For local dev, the app falls back to a built-in dev secret only when `NODE_ENV` is **not** `production`.
- **`next start` (production)** also requires **`AUTH_GOOGLE_ID`** + **`AUTH_GOOGLE_SECRET`** unless you add another provider — the Dev email provider is disabled in production.

## Daily sync (production)

Schedule a job to `POST /api/cron/sync` with header:

`Authorization: Bearer <CRON_SECRET>`

## County adapters

Live parsers are **stubs** until each agency site’s terms and technical access are validated. Palm Beach’s official blotter may require non-automated workflows (e.g. CAPTCHA). Use `SYNC_USE_FIXTURES=true` for demonstration rows.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Vitest |

`postinstall` runs `prisma generate`.

## Legal

This project does not provide legal advice. Display clear disclaimers (included in the UI) and verify data with official sources.
