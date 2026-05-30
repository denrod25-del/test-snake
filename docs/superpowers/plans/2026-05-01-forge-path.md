# Forge Path Implementation Plan

> **For agentic workers:** Implement task-by-task; use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable Next.js app (`forge-path/`) with roadmap UI, typed curriculum, lesson pages (text/callout/quiz/reading), Zustand-persisted XP/streak/completions, Library and Settings (export/import).

**Architecture:** App Router pages consume curriculum data and a small block renderer. Progress lives in a Zustand store with `persist` middleware. No backend auth in MVP.

**Tech Stack:** Next.js 15+, React 19, TypeScript, Tailwind CSS, Zustand.

---

### File map (target)

**Create:**

- `forge-path/package.json` (via `create-next-app`)
- `forge-path/src/app/layout.tsx` — fonts, theme class, providers
- `forge-path/src/app/page.tsx` — home roadmap
- `forge-path/src/app/learn/page.tsx` — module list
- `forge-path/src/app/learn/[moduleId]/page.tsx` — module + lessons
- `forge-path/src/app/learn/[moduleId]/[lessonId]/page.tsx` — lesson
- `forge-path/src/app/library/page.tsx` — reading map
- `forge-path/src/app/settings/page.tsx` — import/export/reset
- `forge-path/src/curriculum/types.ts` — block + module types
- `forge-path/src/curriculum/index.ts` — export `CURRICULUM`, helpers `getModule`, `getLesson`, `flattenLessonOrder`
- `forge-path/src/curriculum/modules/*.ts` — one file per module or split logically
- `forge-path/src/lib/progress-store.ts` — Zustand + persist
- `forge-path/src/components/LessonRunner.tsx` — block dispatch
- `forge-path/src/components/Roadmap.tsx`, `ModuleCard.tsx`, `Header.tsx` as needed

---

### Task 1: Scaffold Next.js app

**Files:**

- Create: `forge-path/**` via CLI

- [x] **Step 1:** From repo root `test snake`, run `create-next-app` for `forge-path` with TypeScript, Tailwind, ESLint, App Router, `src/`, import alias `@/*`.
- [x] **Step 2:** `cd forge-path && npm run build` to verify clean build.

---

### Task 2: Curriculum types + seed content

**Files:**

- Create: `src/curriculum/types.ts`, `src/curriculum/index.ts`, `src/curriculum/modules/01-craft.ts` (and minimal stubs for remaining modules or combine first 3 modules with 2 lessons each for demo)

- [x] **Step 1:** Define `LessonBlock`, `Lesson`, `Module` types matching MVP blocks.
- [x] **Step 2:** Add at least **3 modules** with **2 lessons** each so navigation feels real (expand later).
- [x] **Step 3:** Helpers: `getModule(id)`, `getLesson(moduleId, lessonId)`, `nextLessonId()`, `allModules`.

---

### Task 3: Progress store

**Files:**

- Create: `src/lib/progress-store.ts`
- Create: `src/components/Providers.tsx` — `'use client'` wrapping children with nothing extra if store needs no provider (Zustand persist needs client components for writers; readers can subscribe in client components only).

- [x] **Step 1:** State: `xp`, `streak`, `lastActiveDate`, `completedLessonKeys: Record<string, boolean>`, actions: `completeLesson`, `addXp`, `touchStreak`, `importState`, `exportState`, `reset`.
- [x] **Step 2:** Persist key e.g. `forge-path-progress-v1`.

---

### Task 4: UI — layout, home, learn routes

**Files:**

- Modify: `src/app/layout.tsx`, `globals.css`
- Create components for roadmap and navigation

- [x] **Step 1:** Dark-first theme, readable typography.
- [x] **Step 2:** Home shows module cards, XP, streak, “Continue” link from last visited lesson (store `lastLessonPath`).
- [x] **Step 3:** `/learn/[moduleId]` lists lessons with completion checkmarks.
- [x] **Step 4:** `/learn/[moduleId]/[lessonId]` mounts `LessonRunner`.

---

### Task 5: LessonRunner

**Files:**

- Create: `src/components/LessonRunner.tsx` + block subcomponents if needed

- [x] **Step 1:** Render `text`, `callout`, `quiz`, `reading` blocks.
- [x] **Step 2:** On quiz correct: award XP, mark quiz sub-progress optional (MVP: award once per lesson complete).
- [x] **Step 3:** “Mark complete” / auto-complete on reaching end; `addXp`, `completeLesson`, `touchStreak`, set `lastLessonPath`.

---

### Task 6: Library + Settings

**Files:**

- `src/app/library/page.tsx`, `src/app/settings/page.tsx`

- [x] **Step 1:** Library: static reading map grouped by module theme + external links.
- [x] **Step 2:** Settings: download JSON, upload JSON (file input + validate shape), reset with confirm.

---

### Task 7: Verify

- [x] **Step 1:** `npm run lint && npm run build`
- [x] **Step 2:** Manual smoke: complete one lesson, refresh, export, reset, import.

---

## Post-MVP

- MDX migration, drill blocks, code sandbox, PWA manifest, auth + sync.
