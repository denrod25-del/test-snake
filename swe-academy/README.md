# SWE Academy — The Ultimate Interactive Course

A zero-to-hero, browser-based, self-grading curriculum for becoming a senior full-stack software engineer. Built as a single-page app — **no installs, no build step, no backend.** Just open it in a browser.

## What's inside

### 6 Modules · 31 Lessons
1. **Foundation** — How the web works, JavaScript, APIs, SQL & NoSQL, Git, Docker, security
2. **Architecture** — MVC, monolith vs microservices, event-driven, clean code
3. **Cloud** — AWS essentials, CI/CD, Kubernetes overview
4. **System Design** — Scaling, caching, load balancing, "Design Twitter" walkthrough
5. **Positioning** — GitHub portfolio, building in public, interview prep
6. **Six-Figure Roles** — Career ladder, where to apply, how to negotiate, 12-month roadmap

### Five interactive practice systems
- **JavaScript playgrounds** — edit & run real JS with `await` and `fetch` support
- **HTML / CSS live preview** — code on the left, real browser render on the right
- **In-browser SQL playground** — actual SQLite (via sql.js) with sample tables to query
- **Auto-graded coding challenges** — 18 exercises (incl. Two Sum, Valid Parens, FizzBuzz, bug hunts) with hidden test cases that turn green when you solve them
- **Simulated terminal** — practice `git` commands without risk

### Knowledge-retention systems
- **57 flashcards** with **spaced repetition** (SM-2 algorithm) — cards resurface right when you're about to forget
- **6 cheatsheets** — JS, HTTP, SQL, Git, Docker, System Design — quick reference
- **Per-lesson notes** — auto-saving markdown box for your own takeaways
- **Curated external resources** — best free articles/videos/books per lesson

### Build-along projects
- **Project 1: A Real To-Do App** — 6 polished steps, ship it to GitHub Pages by the end

### Gamification
- **XP system** — earn points for lessons, quizzes, challenges, projects, reviews
- **Daily streak** — show up consistently
- **Progress tracking** — overall %, per-module breakdowns
- **Local-first** — everything saved in your browser via localStorage

## Run it

The app uses an iframe sandbox + sql.js (loaded from CDN), so you should serve it over HTTP rather than `file://`:

```bash
cd swe-academy
python -m http.server 8000
# then open http://localhost:8000
```

Alternatives:
```bash
npx serve .
# or
npx http-server .
```

The SQL playground requires internet on first use (downloads sql.js wasm ~700KB, then cached). Everything else works fully offline.

## File map

| File | Purpose |
|---|---|
| `index.html` | Shell with home screen + 5-tab learn view |
| `styles.css` | Dark theme matching the roadmap aesthetic |
| `app.js` | Engine — rendering, navigation, all interactive widgets, spaced repetition, XP, streak |
| `curriculum.js` | All 31 lessons (the bulk of the content) |
| `challenges.js` | 18 auto-graded coding exercises with test cases |
| `flashcards.js` | 57 spaced-repetition cards |
| `cheatsheets.js` | 6 reference pages |
| `projects.js` | Build-along project content |
| `resources.js` | Per-lesson curated external links |

## Block types (for extending the curriculum)

```js
{ type: 'text',     html: '<p>Rich text</p>' }
{ type: 'code',     lang: 'js', code: 'console.log(1)' }       // read-only sample
{ type: 'play',     lang: 'js', starter: '...' }                // JS playground
{ type: 'htmlplay', starter: '<html>...' }                      // HTML/CSS live preview
{ type: 'sqlplay',  schema: '...', seed: '...', starter: '...' }// SQL playground
{ type: 'challenge', challengeId: 'sum' }                       // auto-graded challenge
{ type: 'terminal', tasks: [{id, desc, match: /regex/}] }       // git/bash sandbox
{ type: 'flashcards', cardIds: ['fc-...'] }                     // inline flashcard stack
{ type: 'quiz',     q, options, answer, why }                   // multiple choice
{ type: 'callout',  tone: 'tip'|'warn', label, html }
{ type: 'diagram',  svg: '<svg ...>...' }
```

## Roadmap

Use it. Show up daily. Build things. Ship them. That's the whole game.
