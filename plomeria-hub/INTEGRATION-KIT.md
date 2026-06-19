# Plomería Hub Integration Kit

A drop-in folder that wires the existing **Plomería Hub** Next.js + Supabase + Stripe + Anthropic app into the **`@bsymbolic/fbc-data`** shared package, giving paying subscribers:

- Server-synced code notes (vs. localStorage-only on the public site)
- Persistent bookmarks across devices
- "Practice this section" cross-links into the existing quiz product
- Conversion attribution tracking from `code.bsymbolic.com → plomeriahub.com`

Public reference users get the same code reading experience but anonymous. The two surfaces share one dataset, one set of calculators, one set of translations.

---

## Prerequisites

- Plomería Hub already runs on Next.js 14+ App Router with `@supabase/ssr`
- Plomería Hub has a server-side Supabase client factory (typical location: `lib/supabase/server.ts`)
- Plomería Hub is in the same monorepo as `@bsymbolic/fbc-data`, or has it added as a dependency

If Plomería Hub isn't yet in the monorepo, the launch plan covers the move:

```powershell
# From the monorepo root
cd apps
mv C:\path\to\existing\plomeria-hub .
cd plomeria-hub
# Edit package.json to add the workspace dep:
#   "@bsymbolic/fbc-data": "workspace:*"
pnpm install
```

---

## Drop-in instructions

1. **Copy this folder into your monorepo:**

   ```
   apps/plomeria-hub/
   ├── components/code/          ← copy `components/*.tsx` and `actions.ts` here
   ├── lib/code-notes.ts         ← copy from this kit's `lib/`
   └── supabase/migrations/      ← copy the SQL migration here
   ```

   > **Path-alias assumption:** components import the helper via `@/lib/code-notes`. This assumes your `tsconfig.json` maps `@/*` to the app root (the Next.js default). If your project uses a different alias, find-and-replace `@/lib/code-notes` in `components/CodeReferencePanel.tsx` and `components/actions.ts`.

2. **Edit `components/code/actions.ts`:**

   ```ts
   // BEFORE (the stub from this kit)
   import { createClient } from "@/lib/supabase/server";

   // AFTER — replace with PH's actual factory path. Examples:
   import { createClient } from "@/lib/supabase/server";
   // or
   import { createServerSupabase as createClient } from "@/utils/supabase";
   ```

3. **Run the migration** in your Supabase project:

   ```bash
   supabase db push
   # or via the SQL editor in the dashboard, paste the migration file
   ```

4. **Wire `<ConversionAttribution />` into your root layout** so traffic from `code.bsymbolic.com` is captured:

   ```tsx
   // apps/plomeria-hub/app/layout.tsx
   import { ConversionAttribution } from "@/components/code/ConversionAttribution";

   export default function RootLayout({ children }) {
     return (
       <html lang="es">
         <body>
           <ConversionAttribution />
           {children}
         </body>
       </html>
     );
   }
   ```

5. **At signup completion, read the attribution and persist:**

   ```tsx
   import { getAttribution, clearAttribution } from "@/components/code/ConversionAttribution";

   async function onSignupComplete(userId: string) {
     const attribution = getAttribution();
     if (attribution) {
       await supabase.from("profiles").update({
         signup_ref: attribution.ref,
         signup_section: attribution.sectionId,
         signup_attribution_captured_at: attribution.capturedAt,
       }).eq("id", userId);
       clearAttribution();
     }
   }
   ```

   You'll need to add `signup_ref`, `signup_section`, `signup_attribution_captured_at` to your `profiles` table.

---

## Using the components

### Embed a code section anywhere

```tsx
import { CodeReferencePanel } from "@/components/code/CodeReferencePanel";
import { createClient } from "@/lib/supabase/server";

export default async function CodigoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  return (
    <CodeReferencePanel
      sectionId={params.id}
      lang="es"
      supabase={supabase}
    />
  );
}
```

When `supabase` is `null` (anonymous user), the panel renders without the notes editor and bookmark button — same content, no logged-in extras.

### Cross-link from a quiz rationale to the public reference

```tsx
import { ViewInCodeLink } from "@/components/code/ViewInCodeLink";

<p>
  La respuesta correcta es A porque{" "}
  <ViewInCodeLink sectionId="909.1" lang="es" />{" "}
  establece la distancia máxima.
</p>
```

The link opens `code.bsymbolic.com/section/909.1?ref=ph` in a new tab. The `?ref=ph` query param feeds code-search's analytics so you can see traffic flowing back from your paid product.

### Cross-link from a code section to a practice quiz for that section

```tsx
import { PracticeForSection } from "@/components/code/PracticeForSection";

<CodeReferencePanel sectionId="909.1" lang="es" supabase={supabase} />
<PracticeForSection
  sectionId="909.1"
  lang="es"
  questionCount={5}
/>
```

The CTA links to `/cuestionario?source=909.1`. Update your quiz page to read the `source` query param and filter the question pool to questions tagged with that section ID.

---

## File-by-file map

| File | What it does |
|---|---|
| `supabase/migrations/20260619000000_code_user_notes.sql` | Creates `code_user_notes` and `code_user_bookmarks` with RLS policies. Defensive length constraints on `section_id` (≤32 chars) and note content (≤16 KB). |
| `lib/code-notes.ts` | Server + browser helpers: `getCodeNote`, `setCodeNote`, `listCodeNotes`, `listCodeBookmarks`, `toggleCodeBookmark`. All inputs validated; throws `RangeError` / `TypeError` on bad input. |
| `components/CodeReferencePanel.tsx` | Server component. Renders a code section with the user's note + bookmark state. Falls back to anonymous render when no Supabase client passed. |
| `components/CodeNotesEditor.tsx` | Client component. Textarea with 500ms debounced autosave via server action. Shows "Saving / Saved / Error" status inline. |
| `components/BookmarkButton.tsx` | Client component. Optimistic bookmark toggle with rollback on failure. |
| `components/actions.ts` | Server actions: `saveCodeNoteAction`, `toggleCodeBookmarkAction`. Return `{ ok, error?, data? }` rather than throwing. **Edit the supabase import path here to match your project.** |
| `components/ViewInCodeLink.tsx` | Inline link to public code-search site with `?ref=ph` attribution. Server component. |
| `components/PracticeForSection.tsx` | CTA card from code section page to PH quiz filtered to that section. Server component. |
| `components/ConversionAttribution.tsx` | Client component + `getAttribution()` helper. Captures `?ref=code&seccion=...` query params into localStorage with a 30-day TTL. First-touch attribution. |

---

## Design system

Components ship with generic Tailwind tokens (`amber-700`, `zinc-800`, etc.) so they work without any setup. To match your "blueprint & brass" Plomería Hub palette:

- Replace `amber-*` with your accent color
- Replace `zinc-*` with your neutral grey scale
- Keep the typography classes (`font-mono`, `font-sans`, `font-display`) — they map to your existing fonts via Tailwind config

Look for the helper Block / Label / Status patterns inside each component; they're cheap to restyle.

---

## Tier

**Strict** for `lib/code-notes.ts` and the server actions in `components/actions.ts` — these touch authenticated user data and the paid product surface. All inputs validated. RLS at the database layer is the second wall behind the helper checks. Errors caught and surfaced as `{ ok: false, error }` rather than thrown to avoid leaking stack traces into client UIs.

**NASA-light** for the presentation components. Standard React patterns, accessible labels, no clever escape hatches.

---

## What's intentionally not in v1

- AHJ overrides (county-specific amendments) — phase 2, requires schema for `code_jurisdiction_notes`
- Highlight history — phase 2, separate `code_user_highlights` table
- Stripe entitlement gates on premium features — straightforward to add once your subscription helper is in PH; gate via a wrapper around `CodeReferencePanel` that swaps `supabase: null` for non-subscribers
- Bulk note export to PDF / Markdown — request-driven feature, defer until users ask

The kit deliberately ships only the integration that pays off immediately: cross-device notes + bookmarks, two-way deep links, and conversion attribution. Everything else is additive.
