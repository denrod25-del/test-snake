# JS Quest — Design spec (approved 2026-05-02)

## Goal

Gamified learning companion aligned with the public curriculum of [javascript.info](https://javascript.info/). Full tutorial text is **not** copied; each lesson links to the official article. Short objectives and quizzes are **original**.

## Stack

- Next.js (App Router), React, TypeScript, Tailwind CSS v4
- Auth.js (`next-auth` v5) with OAuth (GitHub + Google when configured)
- PostgreSQL via Prisma
- Phased content: **Part 1 — Introduction + JavaScript Fundamentals** seeded first

## Data model

- Auth: `User`, `Account`, `Session`, `VerificationToken` (Auth.js + Prisma adapter)
- `Profile`: `xp`, `level`, `streakCount`, `lastActiveDate` (UTC date tracking)
- `Lesson`: metadata + `officialUrl` + optional `summary`
- `QuizQuestion`: multiple choice per lesson
- `UserLessonProgress`: completion + best quiz score

## Game rules (v1)

- Mark lesson complete: +40 XP (once)
- Quiz ≥70%: +30 XP bonus (once per lesson when crossing threshold; idempotent if already credited)
- Level derived from total XP
- Streak: activity on a new UTC calendar day extends streak; gap resets to 1

## Routes

- `/` — marketing + sign-in
- `/dashboard` — path map, stats (protected)
- `/lesson/[slug]` — lesson panel, external link, quiz (protected)

## API

- `GET /api/curriculum` — lessons (public)
- `GET /api/me` — session + profile + progress summary (auth)
- `POST /api/progress` — `{ lessonSlug, action: "complete" }` (auth)
- `POST /api/quiz` — `{ lessonSlug, answers: number[] }` (auth)

## Environment

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` (optional if Google set)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (optional)
- `AUTH_TRUST_HOST=true` for production behind a proxy

## Future

- More parts/chapters via seeds; achievements; spaced repetition.
