# Forge Path — Design Specification

**Status:** Approved (2026-05-01)  
**Scope:** New repository folder `forge-path/`, independent of `swe-academy/`.

## 1. Purpose

Browser-based learning app (Mimo/SoloLearn-style) for beginners pursuing **full-stack software engineering** and **practical AI in apps**. Content is **original**; external books are cited for deeper reading only. **No** copyrighted excerpts or PDF hosting.

## 2. User outcomes

- Understand client/server, HTTP, and JSON APIs.
- Build mental models for **frontend** (HTML/CSS/React/Next.js) and **backend** (route handlers, validation, data).
- Practice **craft** habits (small steps, checklists, readability) without copying proprietary checklist text.
- Touch **algorithms** (Big-O, core structures) and **data systems** themes at a **lite** level before *DDIA*-depth reading.
- Complete an **AI-for-builders** track: API usage, prompt-as-spec, RAG concept, limitations and privacy.

## 3. Technical architecture

| Layer | Choice |
|--------|--------|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Lesson content | Typed curriculum modules (`src/curriculum/` or similar) |
| Client progress | Zustand + `localStorage` persist |
| Deployment target | Vercel-compatible; local `next dev` first |

## 4. Routes

| Path | Function |
|------|----------|
| `/` | Home: roadmap, streak, XP, resume |
| `/learn` | Module index |
| `/learn/[moduleId]` | Module detail + lesson list |
| `/learn/[moduleId]/[lessonId]` | Lesson runner |
| `/library` | Reading map + legal purchase/library links |
| `/settings` | Theme, export/import progress JSON, reset |

## 5. Lesson block types (MVP)

- `text` — HTML string (sanitized or trusted author content only).
- `callout` — `tip` | `warn`, label, body.
- `quiz` — question, options, correct index, explanation.
- `reading` — title, optional note, external URL.

**Phase 2:** `drill-fill`, `drill-reorder`, sandboxed code challenges.

## 6. Progress model

- Per-lesson: `completedBlockIds` or simple `completed: boolean` for MVP.
- Global: `xp`, `lastActiveDate` (streak), optional `badges` array.
- **Export/import** JSON in Settings for portability.

## 7. Curriculum modules (high level)

1. The craft  
2. Computers & the web  
3. JavaScript foundations  
4. Frontend I  
5. React + Next.js  
6. Backend I  
7. Data  
8. Code quality  
9. Design & boundaries  
10. Testing & TDD intro  
11. Algorithms (lite)  
12. Reliability & checklists  
13. AI for builders  

Capstone: narrative from UI → API → data → one AI feature → deploy checklist (text-first in MVP).

## 8. Non-goals (MVP)

- User accounts / server-side progress.
- Embedded judge for arbitrary user-submitted code.
- Mobile-native app.

## 9. Legal & ethics

- No reproduction of book text. Reading list points to publishers, authors, or open documentation.

## 10. Self-review checklist

- [x] No placeholder “TBD” for core decisions.
- [x] Architecture matches features described.
- [x] Scope bounded for MVP vs Phase 2.
