# Florida booking aggregator + comments — Implementation plan

> **For agentic workers:** Implement task-by-task; use checkbox (`- [ ]`) steps for tracking.

**Goal:** Ship a Next.js + PostgreSQL app that daily-syncs booking data from Orange, Miami-Dade, and Palm Beach adapters (where allowed), displays records with mugshots, and supports sign-in-only comments with admin pre-moderation.

**Architecture:** Next.js App Router with Prisma ORM; adapters implement a shared interface and are invoked from a secret-protected cron route; Auth.js for sessions; admin routes gated by allowlisted emails or role.

**Tech stack:** Next.js 15, React, TypeScript, Prisma, PostgreSQL, Auth.js, optional Vercel Blob/S3 for images.

**Code location:** New app in `florida-bookings/` at repo root (sibling to `app/`), to avoid mixing with existing `ftdr-app`.

---

## File map (v1)

| Path | Responsibility |
|------|----------------|
| `florida-bookings/package.json` | Scripts, dependencies |
| `florida-bookings/prisma/schema.prisma` | `BookingRecord`, `Comment`, `SyncRun`, `User`/`Account` if not using Auth.js tables only |
| `florida-bookings/src/lib/db.ts` | Prisma client singleton |
| `florida-bookings/src/lib/adapters/types.ts` | `NormalizedBooking`, adapter interface |
| `florida-bookings/src/lib/adapters/orange.ts` | Orange County ingest |
| `florida-bookings/src/lib/adapters/miami-dade.ts` | Miami-Dade ingest |
| `florida-bookings/src/lib/adapters/palm-beach.ts` | Palm Beach ingest (stub or no-op if blocked) |
| `florida-bookings/src/lib/adapters/index.ts` | Registry + `runAllSyncs` |
| `florida-bookings/src/app/api/cron/sync/route.ts` | Cron: verify secret, run syncs |
| `florida-bookings/src/app/api/records/route.ts` | List/search API or use Server Components only |
| `florida-bookings/src/app/records/[id]/page.tsx` | Detail + comments |
| `florida-bookings/src/app/admin/comments/page.tsx` | Moderation queue |
| `florida-bookings/src/app/admin/actions.ts` | Server actions: approve/reject |
| `florida-bookings/tests/fixtures/` | Saved HTML/JSON for adapter tests |

---

### Task 1: Scaffold Next.js app

**Files:**

- Create: `florida-bookings/package.json`, `florida-bookings/tsconfig.json`, `florida-bookings/next.config.ts`, `florida-bookings/src/app/layout.tsx`, `florida-bookings/src/app/page.tsx`

- [ ] **Step 1:** From repo root, run:

```bash
npx create-next-app@latest florida-bookings --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Use defaults that enable App Router and `src/`.

- [ ] **Step 2:** `cd florida-bookings` and verify:

```bash
npm run dev
```

Open `http://localhost:3000` — expect Next.js welcome page.

- [ ] **Step 3:** Commit (if using git): `git add florida-bookings && git commit -m "chore: scaffold florida-bookings Next.js app"`

---

### Task 2: Prisma schema and database

**Files:**

- Create: `florida-bookings/prisma/schema.prisma`
- Create: `florida-bookings/src/lib/db.ts`
- Create: `florida-bookings/.env.example`

- [ ] **Step 1:** Install deps:

```bash
cd florida-bookings
npm install prisma @prisma/client --save-dev
npm install @prisma/client
npx prisma init
```

- [ ] **Step 2:** Define schema (replace `schema.prisma` datasource with your PostgreSQL URL):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum County {
  ORANGE
  MIAMI_DADE
  PALM_BEACH
}

enum CommentStatus {
  pending
  approved
  rejected
}

model BookingRecord {
  id                  String   @id @default(uuid())
  county              County
  sourceSystem        String
  externalId          String
  personName          String
  bookingDate         DateTime?
  chargesText         String?
  mugshotUrl          String?
  mugshotStorageKey   String?
  officialSourceUrl   String?
  rawMetadata         Json?
  firstSeenAt         DateTime @default(now())
  lastSeenAt          DateTime @updatedAt
  lastSyncedAt        DateTime?

  comments            Comment[]

  @@unique([county, sourceSystem, externalId])
  @@index([county, personName])
  @@index([bookingDate])
}

model Comment {
  id                 String        @id @default(uuid())
  bookingRecordId    String
  bookingRecord      BookingRecord @relation(fields: [bookingRecordId], references: [id], onDelete: Cascade)
  authorUserId       String
  body               String
  status             CommentStatus @default(pending)
  moderatedByUserId  String?
  moderatedAt        DateTime?
  createdAt          DateTime      @default(now())

  @@index([status])
  @@index([bookingRecordId])
}

model SyncRun {
  id               String   @id @default(uuid())
  county           County
  startedAt        DateTime @default(now())
  finishedAt       DateTime?
  status           String
  errorMessage     String?
  recordsUpserted  Int      @default(0)
}
```

- [ ] **Step 3:** `db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4:** `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASS@HOST:5432/florida_bookings?sslmode=require"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
CRON_SECRET="long-random-string"
ADMIN_EMAILS="you@example.com"
# OAuth (example)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

- [ ] **Step 5:** Migrate:

```bash
npx prisma migrate dev --name init
```

Expected: migration folder created, client generated.

---

### Task 3: Auth.js (sign-in required for comments)

**Files:**

- Create: `florida-bookings/src/auth.ts`
- Create: `florida-bookings/src/app/api/auth/[...nextauth]/route.ts` (or follow Auth.js v5 beta layout for your chosen version)
- Modify: `florida-bookings/src/app/layout.tsx` — session provider if needed

- [ ] **Step 1:** Install:

```bash
npm install next-auth@beta
```

(Follow current Auth.js v5 Next.js integration docs for exact file names.)

- [ ] **Step 2:** Implement Google (and optionally Resend/nodemailer for magic link). Ensure `session.user.id` is available (may require `adapter` + DB user table, or JWT `sub` from provider).

- [ ] **Step 3:** Add `lib/auth-helpers.ts`:

```typescript
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  return session;
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}
```

- [ ] **Step 4:** Manual test: sign in, confirm session on a test page.

---

### Task 4: Upsert helper and sync orchestrator

**Files:**

- Create: `florida-bookings/src/lib/sync/upsert.ts`
- Create: `florida-bookings/src/lib/adapters/types.ts`
- Create: `florida-bookings/src/lib/sync/run-sync.ts`

- [ ] **Step 1:** `types.ts`:

```typescript
import type { County } from "@prisma/client";

export type NormalizedBooking = {
  county: County;
  sourceSystem: string;
  externalId: string;
  personName: string;
  bookingDate: Date | null;
  chargesText: string | null;
  mugshotUrl: string | null;
  officialSourceUrl: string | null;
  rawMetadata?: Record<string, unknown>;
};

export type CountyAdapter = {
  county: County;
  run: () => Promise<NormalizedBooking[]>;
};
```

- [ ] **Step 2:** `upsert.ts` — for each normalized row, `prisma.bookingRecord.upsert` on `county_sourceSystem_externalId` composite (use the unique constraint fields in `where`).

- [ ] **Step 3:** `run-sync.ts` — iterate adapters, create `SyncRun`, try/catch per county, log `recordsUpserted`.

---

### Task 5: County adapters (fixtures-first)

**Files:**

- Create: `florida-bookings/src/lib/adapters/orange.ts`
- Create: `florida-bookings/src/lib/adapters/miami-dade.ts`
- Create: `florida-bookings/src/lib/adapters/palm-beach.ts`
- Create: `florida-bookings/tests/adapters/orange.test.ts` (Vitest)

- [ ] **Step 1:** Add Vitest:

```bash
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2:** Save **sanitized** fixture files under `tests/fixtures/orange-sample.html` (etc.) from public pages **only if license permits**; otherwise construct minimal synthetic HTML matching structure.

- [ ] **Step 3:** Implement parsers that read fixture files in tests; production path fetches live URL with `fetch`, timeout, and user-agent identifying your bot + contact email in README.

- [ ] **Step 4:** Palm Beach: if CAPTCHA blocks `fetch`, implement `run()` that returns `[]` and sets `SyncRun.errorMessage` to `CAPTCHA_OR_MANUAL_ONLY` — **do not** automate CAPTCHA.

---

### Task 6: Cron API route

**Files:**

- Create: `florida-bookings/src/app/api/cron/sync/route.ts`

- [ ] **Step 1:** `POST` handler validates `Authorization: Bearer ${CRON_SECRET}` (or compare query param in dev only).

- [ ] **Step 2:** Calls `runSync()` and returns JSON `{ ok: true, results: [...] }`.

- [ ] **Step 3:** Configure Vercel `vercel.json` cron or document external scheduler.

---

### Task 7: Public UI — list and detail

**Files:**

- Create: `florida-bookings/src/app/records/page.tsx`
- Create: `florida-bookings/src/app/records/[id]/page.tsx`
- Create: `florida-bookings/src/components/disclaimer.tsx`

- [ ] **Step 1:** List page: server component, query `prisma.bookingRecord.findMany` with `searchParams` q + county filter, pagination.

- [ ] **Step 2:** Detail: show image via `mugshotUrl` (or next/image remotePatterns); disclaimer component at top.

---

### Task 8: Comments (submit pending)

**Files:**

- Create: `florida-bookings/src/app/records/[id]/actions.ts`
- Create: `florida-bookings/src/components/comment-form.tsx`

- [ ] **Step 1:** Server action `submitComment(recordId, formData)` — `requireSession()`, validate body length 1–2000, `prisma.comment.create({ data: { ..., status: pending } })`.

- [ ] **Step 2:** Detail page lists `comment.findMany({ where: { bookingRecordId, status: approved } })`.

---

### Task 9: Admin moderation

**Files:**

- Create: `florida-bookings/src/app/admin/layout.tsx`
- Create: `florida-bookings/src/app/admin/comments/page.tsx`
- Create: `florida-bookings/src/app/admin/comments/actions.ts`

- [ ] **Step 1:** Layout checks `isAdmin(session.user.email)`; redirect if false.

- [ ] **Step 2:** Queue loads `status: pending`. Approve/reject server actions set `moderatedAt`, `moderatedByUserId`, `status`.

---

### Task 10: Polish and README

**Files:**

- Create: `florida-bookings/README.md`

- [ ] **Step 1:** Document env vars, cron setup, legal disclaimer, and **how to request takedowns**.

- [ ] **Step 2:** `npm run build` must pass.

```bash
npm run build
```

Expected: success, no type errors.

---

## Verification checklist (before “done”)

- [ ] `npx prisma migrate deploy` works against fresh DB
- [ ] Sign-in → submit comment → remains invisible on public page until approved
- [ ] Admin approves → comment visible
- [ ] Cron route rejects bad secret with 401
- [ ] At least one adapter covered by fixture test
