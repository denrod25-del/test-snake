# AGENTS.md

## Learned User Preferences

- After building or changing a web project, start a local server and give the exact clickable localhost URL; the user almost always asks "how do I open it" otherwise.
- If a localhost URL fails (ERR_CONNECTION_REFUSED) or the port is busy, serve on a new port and verify the server responds before sharing the link.
- Prefers `python -m http.server 8765` for serving static HTML projects (wired up as the `serve` script in the root `package.json`).
- Beginner-level developer: wants plain-language, step-by-step instructions for setup and deployment tasks (e.g. GitHub Pages).
- Likes clarifying questions and honest pushback on feasibility before a new project is built; kickoff prompts often include "ask me any questions for clarity".
- Expects real working content and data, not placeholders; has repeatedly pushed back on generic lesson text, dead links, and non-functional features — verify things actually work before reporting done.
- Permit-search and other PBC research tools are now deployed to **Netlify** (same site as DeedScout) so they share the Stripe + Supabase payment plumbing the user already configured there. Vercel auto-deploy was disconnected from this repo in the Vercel dashboard on 2026-06-28; do NOT push to Vercel for these tools. A single `git push origin master` is the deploy mechanism — no CLI needed.

## Learned Workspace Facts

- `C:\Users\skyea\projects\test snake` is a monorepo of many unrelated mini-projects: snake game, pinball, Florida tax-deed registry, Palm Beach GIS tools (parcel lookup, subdivision index, permits), plumbing/water-filtration/heater lead generators, and SWE learning apps (e.g. `code-masters`).
- `heaterquote/` is a Next.js + Tailwind + Supabase MVP for water heater replacement cost estimates and lead capture (`/estimate`, `/admin`).
- PBC research tools (`subdivision-index.html`, `plat-index.html`, `permit-search.html`, `parcel-lookup.html`) deploy to **Netlify** at `https://deedscout.netlify.app/<page>.html` alongside DeedScout (`tax-deeds.html`). `netlify.toml` publishes the repo root. (The prior Vercel deploy was disconnected from GitHub on 2026-06-28 and `vercel.json` was deleted; do NOT re-add Vercel config.) `scraper/` and monthly GitHub Actions refresh `data/subdivisions/`, `data/plats/`, and `data/permits/`; plat PDF names OCR'd via `extract_plat_names.py` (PyMuPDF + RapidOCR). `permit-search.html` has Trends & Stats charts plus a Plumbing Watch tab (dataset-wide plumbing-permit hotspot tracker with 30/30 growth-ratio prediction).
- `permit-search.html` data sources (live Tyler EnerGov scrapes via `scraper/parsers_permits.py:parse_tyler_energov`, ~4k permits each on a 40-page hard cap): West Palm Beach, Boca Raton, Jupiter (self-hosted at `cds.jupiter.fl.us/EnerGov_Prod/selfservice`, so the parser supports a configurable `basePath`), and St. Lucie County. Royal Palm Beach (Click2Gov + Avolve ProjectDox) and Boynton Beach (SagesGov) have no public bulk API and are flagged `unsupported_paywall`.
- Root `index.html` redirects to `tax-deeds.html` (DeedScout freemium MVP on Netlify at `https://deedscout.netlify.app/tax-deeds.html`, target brand domain `deedscout.app`; Supabase auth + Stripe checkout via `netlify/functions/` with `"type": "commonjs"` in `netlify/functions/package.json`; Pro paywall; schema in `supabase/schema.sql`; Supabase Auth Site URL and redirect URLs must use the Netlify site host, not the supabase.co dashboard URL); the snake game ("iSnake", iPhone 17 styled) lives in `landing.html` / `game.html`.
- A `space-cadet-pinball` clone is checked out in the workspace with a built exe at `space-cadet-pinball\bin\Release\SpaceCadetPinball.exe` (game data files not included).
- Machine tooling: Visual Studio Community 2026, VS Build Tools 2026/2022, CMake 4.3.2, msys64 MinGW, winget, Python, and Node.js/npm.
- CMake may wrongly pick up the msys64 MinGW toolchain; MSVC SDL paths must be forced explicitly when configuring C++ builds.
- PowerShell script execution is disabled on this machine (`npm.ps1` is blocked by execution policy); invoke npm via `npm.cmd` or `cmd /c npm ...`.
- Several sub-projects are standalone Next.js apps with their own `package.json` (e.g. `code-masters`); many of the Florida tools target Palm Beach County public records.
