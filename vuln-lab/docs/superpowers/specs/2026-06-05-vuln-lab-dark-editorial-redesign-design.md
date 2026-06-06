# Vuln Lab — Dark Editorial Redesign

**Date:** 2026-06-05
**Status:** Approved (design), ready for implementation plan
**Scope:** Whole-site visual redesign of Vuln Lab. Presentation only — no changes to vulnerability-module logic.

## Goal

Restyle the existing Vuln Lab static site from its current GitHub-dark "tool" aesthetic to a **dark editorial** look inspired by phenomenonstudio.com: oversized display type, generous whitespace, a single confident accent, and subtle motion — while keeping the fast catalog navigation that makes a 10-module reference usable.

This is a CSS + light-markup redesign. It must remain a **zero-build, dependency-free, vanilla HTML/CSS/ES-modules** static site that deploys as-is.

## Approved design decisions

| Decision | Choice |
|----------|--------|
| Direction | **B — Dark Editorial** (near-black canvas, big type, lots of air) |
| Scope | **Whole site** — home, all 10 bug pages, sidebar, code blocks, sandbox |
| Layout | **L2 — Editorial landing**: home is a full-width hero + catalog grid (no sidebar); bug pages keep a restyled sidebar |
| Accent | **Hot Magenta `#ff5d8f`** (brand only; severity colors stay separate) |
| Typography | **Space Grotesk** (display) + **Inter** (body), via Google Fonts, with system fallbacks |

## Visual system (design tokens)

Define as CSS custom properties on `:root` in `css/styles.css`.

**Color**
- `--bg: #0a0b0e` (canvas), `--bg-elev: #14161b` (panels/cards), `--bg-elev-2: #1b1e26` (insets, code-head)
- `--border: #242833`
- `--text: #f3f4f6`, `--text-dim: #98a0ad`
- `--accent: #ff5d8f` (brand magenta), `--accent-dim: #e23f74` (hover/active), `--accent-ink: #1a0710` (text on magenta fills)
- Severity (kept semantic, rendered as **outlined chips** so they never read as the brand): `--red: #ff6a5d` (Critical), `--amber: #ffb03a` (High), `--blue: #5cc8ff` (Medium), `--green: #46d07f` (Low)
- Sandbox verdict colors reuse severity tokens: exploited→red, blocked/safe→green, inert→amber. The "Vulnerable" toggle uses red; "Run" button uses the magenta accent.

**Type**
- `--display: 'Space Grotesk', system-ui, sans-serif;` — headings (hero h1, section h2, card/bug titles, brand, big numerals)
- `--sans: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;` — body/UI
- `--mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;` — code, inputs, trace values
- Load via one `<link>` in `index.html`: `Space Grotesk` (500,600,700) + `Inter` (400,500,600,700), `display=swap`, with `preconnect`.
- Scale: hero `clamp(2.4rem, 6vw, 3.6rem)` (~58px), letter-spacing `-0.03em`, line-height `~0.96`; section h2 ~1.5rem; bug-page h1 ~2rem; body 16px / line-height 1.55.

**Spacing / radius / motion**
- Section rhythm: generous vertical padding (home sections ~56–72px top).
- Radius: cards/panels `12px`, buttons/inputs `8px`, tags pill `999px`.
- Motion: hover lift on cards (`translateY(-2px)`, border→accent, ~0.15s); reveal-on-scroll fade+rise; **all motion gated behind `@media (prefers-reduced-motion: no-preference)`**.

## Structure

### Top bar (`index.html`)
Replace the current brand+tagline bar with a sticky nav: brand (`🧪 Vuln Lab`, "Lab" in magenta) on the left; right side links **Bugs · About · GitHub** + a magenta **Start →** CTA. Keep the skip-link. The tagline moves into the home hero.

### Home / landing (route `#/`)
No sidebar. Rendered by `js/app.js` `renderHome()`:
1. **Hero**: eyebrow ("Interactive security playground") → display headline "Break it. Then patch it." → subhead paragraph → two CTAs — primary **`Start the lab →`** navigates to the first bug in display order (`#/path-traversal`); secondary **`Browse the catalog ↓`** smooth-scrolls to the catalog grid further down the home page — → a **stat row** (`10` vuln modules · `100%` client-side · `0` real systems harmed). The top-bar **`Start →`** CTA also navigates to the first bug.
2. **Catalog**: a small section label, then bug cards **grouped by severity** (Critical→High→Medium→Low) using the existing `groupBySeverity()`. Each card: index number, outlined severity chip, display title, one-line summary; hover lift.

### Bug page (route `#/<id>`)
Sidebar **returns** (restyled): filter input + severity-grouped nav list + the "simulation only" footnote. Content keeps the existing 4-step flow rendered by `renderBug()` — Why it happens → The vulnerable pattern → Live sandbox → The fix → References — re-skinned with the new tokens. Code blocks, the Vulnerable⟷Patched toggle, presets, result trace, note, and the demo iframe all get restyled but keep identical structure/behavior.

### Home vs. bug layout switch
`index.html` keeps a `.layout` shell, but the sidebar's visibility is route-driven. `route()` in `app.js` sets a class on `<body>` (e.g. `route-home` / `route-bug`). CSS: on `route-home`, hide `.sidebar` and let `.content` span full width with a wider hero max-width; on `route-bug`, show the two-column grid. This avoids restructuring the router.

### Reveal-on-scroll
A tiny inline helper (in `app.js` or a small `js/reveal.js`): after each render, observe elements tagged `.reveal` with `IntersectionObserver`, adding `.in` to fade+rise them once. No-op when `prefers-reduced-motion: reduce` or when `IntersectionObserver` is unavailable (elements just render visible).

## What changes vs. stays

**Changes (presentation only)**
- `css/styles.css` — full rewrite to the new token system + components.
- `index.html` — font `<link>` + `preconnect`; nav/top-bar markup; body gets route class hook.
- `js/app.js` — `renderHome()` gains hero + stat row + severity-grouped grid; `route()` sets the body route class; add reveal-on-scroll wiring. Class-name/markup hooks only.
- (Optional) `js/reveal.js` — the IntersectionObserver helper, if not inlined.

**Stays untouched (zero risk to verified behavior)**
- All 10 `bugs/*.js` modules (content + `run()` logic).
- `js/registry.js`, `js/manifest.js`.
- `js/ui.js` sandbox/code-block/result rendering **logic** — only its emitted class names may gain hooks if needed for styling; the DOM contract and the sandboxed `allow-scripts` iframe behavior are preserved.

## Accessibility & responsiveness
- Contrast: magenta `#ff5d8f` on `#0a0b0e` and as a fill with `--accent-ink` text both meet AA for UI text/large text; verify body-dim text ≥ 4.5:1.
- Severity meaning never relies on the brand accent; chips carry text labels + color + border.
- Keep visible focus rings (accent-colored) on inputs, toggles, links, buttons; preserve the skip-link.
- Respect `prefers-reduced-motion`.
- Breakpoints: catalog grid 3→2→1 columns; bug-page sidebar collapses above content on narrow screens (existing `@media (max-width: 820px)` pattern); hero type uses `clamp()`.

## Non-goals
- No changes to vulnerability content, simulations, or `run()` logic.
- No build step, bundler, framework, or runtime dependency (Google Fonts `<link>` is the only external resource; acceptable, with system fallbacks).
- No new bug modules (roadmap is already 10/10).
- No deployment/CI changes in this work.

## Success criteria
- All 10 modules still load and validate; every sandbox behaves exactly as before (no console errors).
- Home renders the hero + severity-grouped catalog with no sidebar; bug pages render the restyled sidebar + 4-step flow.
- Visual system matches the approved mockup (dark editorial, magenta accent, Space Grotesk/Inter, big type, whitespace, subtle motion).
- Keyboard nav, focus states, skip-link, and reduced-motion all work; layout holds at mobile/tablet/desktop widths.
