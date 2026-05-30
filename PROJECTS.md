# Website projects

Monorepo of web apps and static sites built in this workspace. Each folder is an independent project.

## Next.js / React apps

| Folder | Description |
|--------|-------------|
| `code-masters/` | Code Masters — challenge catalog and guided lessons (CodeCrafters-style) |
| `florida-bookings/` | Florida booking aggregator — mugshots and in-custody records |
| `gentoomen-hub/` | Gentoomen Hub — learning hub |
| `forge-path/` | Forge Path — interactive learning paths |
| `js-quest/` | JavaScript quest / tutorial app |
| `app/` | Main Vite/React app |
| `school-shooting-tracker/` | School shooting tracker |

## Static HTML / lightweight sites

| Folder | Description |
|--------|-------------|
| `atlases-logical-equivalence/` | Logical equivalence truth-table lab |
| `atlases-truth-table/` | Truth table generator lab |
| `build-your-own-x/` | Build-your-own-X reference |
| `swe-academy/` | SWE Academy landing |
| `openart/` | OpenArt gallery |
| `fl-bankruptcy/` | Florida bankruptcy lookup |
| `counties/` | County data browser |
| `plumbing-leads/` | Plumbing leads dashboard (static + API) |
| `water-leads/` | Water filtration leads dashboard |

## Root-level tools

| File | Description |
|------|-------------|
| `parcel-lookup.html` | Palm Beach County parcel → address lookup |
| `permit-search.html` | PBC permit keyword search |
| `index.html` | Snake game (original project) |

## Python backends / scrapers

| Folder | Description |
|--------|-------------|
| `searchlab/` | SearchLab full-text search app |
| `scraper/` | Permit and property data scrapers |
| `symbolic/` | Symbolic reasoning toolkit (also at [denrod25-del/symbolic](https://github.com/denrod25-del/symbolic)) |

## Run locally

Each project has its own README. Typical patterns:

```bash
# Static HTML — open index.html or:
python -m http.server 8000

# Next.js
cd code-masters && npm install && npm run dev

# Vite
cd app && npm install && npm run dev
```
