# Plomería Hub

A Florida Plumbing Code (FBC-P) reference app — **Next.js 14 (App Router) + Supabase + Tailwind** — with the `@bsymbolic` code-notes **integration kit** wired in:

- **Bilingual** (Spanish / English) FBC-P code sections
- **Server-synced personal notes** per section (for signed-in users; falls back to anonymous read-only when Supabase isn't configured)
- **Cross-device bookmarks**
- **"Practice this section"** cross-links into the quiz surface
- **Conversion attribution** capture from `code.bsymbolic.com → plomeriahub.com`

The integration-kit files in `components/code/`, `lib/code-notes.ts`, and `supabase/migrations/` are the **drop-in kit, used verbatim**. This app supplies the two pieces the kit expects the host to already have:

- `lib/fbc-data.ts` — a local stand-in for the shared `@bsymbolic/fbc-data` package (mapped to the `@bsymbolic/fbc-data` import via `tsconfig.json` paths), with real FBC-P content.
- `lib/supabase/server.ts` — the `@supabase/ssr` server-client factory the kit imports as `@/lib/supabase/server`.

See `INTEGRATION-KIT.md` for the original kit documentation.

---

## Run locally

```bash
cd plomeria-hub
npm install
npm run dev      # http://localhost:3000
```

The app runs **without any configuration** in anonymous (read-only) mode — you can browse all code sections. Notes and bookmarks turn on once Supabase is configured (below).

To build/serve the production bundle:

```bash
npm run build
npm run start    # http://localhost:3000
```

---

## Configure Supabase (optional — enables notes & bookmarks)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the migration**: open the Supabase dashboard → **SQL Editor** → paste the contents of
   `supabase/migrations/20260619000000_code_user_notes.sql` → **Run**.
   This creates `code_user_notes` and `code_user_bookmarks` with Row-Level Security so each
   user can only ever read/write their own rows.
3. Copy `.env.example` to `.env.local` and fill in your values from Supabase → **Settings → API**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

> Note: this app ships the **data + UI** for notes/bookmarks. It does not include a login screen
> — wiring Supabase Auth (e.g. magic-link sign-in) is the one remaining step to let real users
> sign in. Until a user is authenticated, every page renders in anonymous mode.

---

## Deploy to Vercel (step by step)

This project lives in the `plomeria-hub/` subfolder of a larger repo, so you tell Vercel to treat
that subfolder as the project root.

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub.
2. Click **Add New… → Project**.
3. **Import** the `denrod25-del/test-snake` repository.
4. On the configure screen:
   - **Root Directory** → click **Edit** → choose **`plomeria-hub`**. *(This is the important step — without it Vercel builds the wrong folder.)*
   - **Framework Preset** → Vercel auto-detects **Next.js**. Leave the build/output settings as the defaults.
5. (Optional, for notes/bookmarks) Open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `NEXT_PUBLIC_CODE_SITE_URL` | `https://code.bsymbolic.com` (optional) |
6. Click **Deploy**. Vercel installs, builds, and gives you a live `*.vercel.app` URL.

Every future push to this branch redeploys automatically.

---

## What's inside

| Path | What it is |
|---|---|
| `app/page.tsx` | Home — index of FBC-P sections |
| `app/codigo/[seccion]/page.tsx` | Section detail — uses the kit's `CodeReferencePanel` + `PracticeForSection` |
| `app/cuestionario/page.tsx` | Quiz surface — reads `?source=<sectionId>` and cross-links via `ViewInCodeLink` |
| `app/layout.tsx` | Root layout — mounts `ConversionAttribution` |
| `components/code/*` | **Integration kit (verbatim)** |
| `lib/code-notes.ts` | **Integration kit (verbatim)** — validated Supabase helpers |
| `lib/fbc-data.ts` | Local `@bsymbolic/fbc-data` stand-in with real FBC-P content |
| `lib/supabase/server.ts` | `@supabase/ssr` server-client factory |
| `supabase/migrations/*.sql` | **Integration kit (verbatim)** — tables + RLS |
