# AGENTS.md

## Learned User Preferences

- After building or changing a web project, start a local server and give the exact clickable localhost URL; the user almost always asks "how do I open it" otherwise.
- If a localhost URL fails (ERR_CONNECTION_REFUSED) or the port is busy, serve on a new port and verify the server responds before sharing the link.
- Prefers `python -m http.server 8765` for serving static HTML projects (wired up as the `serve` script in the root `package.json`).
- Beginner-level developer: wants plain-language, step-by-step instructions for setup and deployment tasks (e.g. GitHub Pages).
- Likes clarifying questions and honest pushback on feasibility before a new project is built; kickoff prompts often include "ask me any questions for clarity".
- Expects real working content and data, not placeholders; has repeatedly pushed back on generic lesson text, dead links, and non-functional features — verify things actually work before reporting done.

## Learned Workspace Facts

- `C:\Users\skyea\projects\test snake` is a monorepo of many unrelated mini-projects: snake game, pinball, Florida tax-deed registry, Palm Beach GIS tools (parcel lookup, subdivision index, permits), plumbing/water-filtration/heater lead generators, and SWE learning apps (e.g. `code-masters`).
- `heaterquote/` is a Next.js + Tailwind + Supabase MVP for water heater replacement cost estimates and lead capture (`/estimate`, `/admin`).
- `subdivision-index.html` and `scraper/scrape_subdivisions.py` provide a searchable index of legal Palm Beach County subdivision/plat names from Property Appraiser GIS (`data/subdivisions/palm-beach.json`).
- Root `index.html` redirects to `tax-deeds.html` (Florida Tax Deed Registry); the snake game ("iSnake", iPhone 17 styled) lives in `landing.html` / `game.html`.
- A `space-cadet-pinball` clone is checked out in the workspace with a built exe at `space-cadet-pinball\bin\Release\SpaceCadetPinball.exe` (game data files not included).
- Machine tooling: Visual Studio Community 2026, VS Build Tools 2026/2022, CMake 4.3.2, msys64 MinGW, winget, Python, and Node.js/npm.
- CMake may wrongly pick up the msys64 MinGW toolchain; MSVC SDL paths must be forced explicitly when configuring C++ builds.
- PowerShell script execution is disabled on this machine (`npm.ps1` is blocked by execution policy); invoke npm via `npm.cmd` or `cmd /c npm ...`.
- Several sub-projects are standalone Next.js apps with their own `package.json` (e.g. `code-masters`); many of the Florida tools target Palm Beach County public records.
