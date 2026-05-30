// Per-module capstones: concrete "job signal" checklist + README template employers recognize.
window.CAPSTONES = [
  {
    moduleId: 'foundation',
    title: 'Foundation — Ship a thin full-stack slice',
    intro: `On a real team, Foundation means you can read/write code and not break prod basics (HTTP, Git, DB, Docker). Employers look for repos that prove this — not course certificates.`,
    portfolioReadme: `# <Project name>

## What this proves (Foundation)
Small app with: browser UI → API → Postgres (or SQLite) → deployed container or PaaS.

## Run locally

\`\`\`bash
git clone ...
cp .env.example .env   # DATABASE_URL etc.
docker compose up -d    # optional
npm install && npm run dev
\`\`\`

## Screenshots / demo
Paste a GIF or deployed URL.

## What I learnt
3 bullets tying this repo to DNS, REST, Git, Docker, SQL, or security.`,
    checklist: [
      { id: 'f1', label: 'Repo on GitHub with README that explains how to run in 3 commands or fewer' },
      { id: 'f2', label: 'At least one GET + one POST (or mutation) API route you wrote yourself' },
      { id: 'f3', label: 'Data persisted in SQL (Postgres/SQLite) with a real schema (2+ tables or 1 table + migration story)' },
      { id: 'f4', label: 'HTTPS in prod (Vercel/Netlify/Render/Fly — any free tier is fine)' },
      { id: 'f5', label: 'Secrets only in .env — never committed (show .env.example instead)' },
      { id: 'f6', label: 'One paragraph in README: what you would add next for scale (cache, queue, read replica)' },
    ],
  },
  {
    moduleId: 'architecture',
    title: 'Architecture — Draw and justify one system',
    intro: `Staff-level signal: you can separate concerns, name boundaries, and explain trade-offs in plain English.`,
    portfolioReadme: `# Architecture write-up: <System name>

## Context
Users, scale guess, read/write ratio.

## Diagram
ASCII or image: client → API → services → DB → cache/queue.

## Trade-offs
Why monolith vs services *for this* problem. What breaks first at 10× load.

## Code map
Link to folders: /api, /domain, /infra — what lives where and why.`,
    checklist: [
      { id: 'a1', label: 'One diagram (even hand-drawn photo) published in repo or Notion, linked from README' },
      { id: 'a2', label: 'List 3 failure modes (DB down, slow partner API, traffic spike) + mitigations' },
      { id: 'a3', label: 'Refactor one messy function into 2+ with clear names (commit message explains why)' },
    ],
  },
  {
    moduleId: 'cloud',
    title: 'Cloud — Automate deploy + observe',
    intro: `Prove you can ship like a team: CI runs tests; prod is reproducible; you know where logs live.`,
    portfolioReadme: `# Cloud notes

## Infra
Provider, services used (e.g. S3, RDS, Lambda, ALB — pick what you actually used).

## CI/CD
Link to workflow file. What runs on every PR.

## Cost guardrail
Billing alarm or spend cap screenshot (redact account id).

## Incident story
One real bug you fixed using logs/metrics (even if it was your toy app).`,
    checklist: [
      { id: 'c1', label: 'GitHub Action (or similar) that runs tests or build on push' },
      { id: 'c2', label: 'Deployed artifact (container or static+API) with a public URL' },
      { id: 'c3', label: 'Documented IAM / least-privilege thought: what the deploy role can and cannot do' },
    ],
  },
  {
    moduleId: 'system',
    title: 'System Design — Back-of-envelope + bottleneck',
    intro: `Interview signal: numbers, bottlenecks, and a story that isn't "use microservices because Google."`,
    portfolioReadme: `# Design doc: <e.g. URL shortener>

## Requirements
Functional + non-functional (latency, durability).

## Capacity sketch
DAU, QPS, storage per year.

## API & data model
Core tables/keys.

## Deep dive
Pick one hard part (ID generation, feed fan-out, cache).

## Failure & cost
What you monitor; what you'd cut if budget halved.`,
    checklist: [
      { id: 's1', label: 'One-page design doc with QPS/storage estimate (order-of-magnitude is fine)' },
      { id: 's2', label: 'Explicit bottleneck callout: "At X scale, Y dies first because…"' },
      { id: 's3', label: 'Cache strategy named (cache-aside vs write-through) with invalidation story' },
    ],
  },
  {
    moduleId: 'positioning',
    title: 'Positioning — Public proof of work',
    intro: `Better than app XP: GitHub graph, writing, and a clear niche sentence recruiters can repeat.`,
    portfolioReadme: `# Hi, I'm <name>

## One-liner niche
"I help <who> ship <what> using <stack>."

## Pinned repos (3–4)
Each has screenshot + live demo + tests.

## Writing
Link 2+ posts: build log, bug post, or explainer.

## Open source
Link 1 contribution (even docs).`,
    checklist: [
      { id: 'p1', label: 'GitHub profile README (username repo) with niche + pinned repos' },
      { id: 'p2', label: 'One technical post (dev.to, personal site, or GH discussion export)' },
      { id: 'p3', label: 'Record a 60s Loom-style video walking through your best repo (unlisted YouTube is fine)' },
    ],
  },
  {
    moduleId: 'roles',
    title: 'Roles — Packet + negotiation prep',
    intro: `Job signal: you can show comp data, talk impact in STAR, and negotiate without ghosting.`,
    portfolioReadme: `# Job search packet (private repo OK)

## Target roles
3 titles + 10 companies.

## STAR stories (3)
Situation, task, action, metric.

## Comp targets
levels.fyi ranges + your ask.

## Questions I ask them
Team, on-call, perf, promotion path.`,
    checklist: [
      { id: 'r1', label: 'levels.fyi or Pave note for 2 target companies with your level band' },
      { id: 'r2', label: '3 STAR stories written (even rough) — each with a number' },
      { id: 'r3', label: 'Written answer: "Why this company?" for your top pick' },
    ],
  },
];
