# Symbolic Development — Homepage Redesign Pass

A concrete redesign of the homepage at
[symbolic-development-design-system.vercel.app](https://symbolic-development-design-system.vercel.app),
built from the UI audit (hero + homepage section cleanup first).

Open `index.html` in a browser (or `python -m http.server 8765` from this folder).
It is a single self-contained page using the site's **real copy, real product
screenshots, and real design tokens** (obsidian/carbon/graphite grays,
`#2e8cff` blue, Space Grotesk / Inter / JetBrains Mono).

## What changed and why

| Area | Before (live site) | After (this pass) |
|------|--------------------|-------------------|
| Hero | Boxed side image, 2 loud CTAs, stat boxes inside the fold | Full-bleed monolith background with gradient fade, one primary button + one text link, one live-status line; stats moved below the fold |
| Nav | Outlined pill CTA competing with hero CTA | Brand gets a geometric mark; nav CTA becomes text-weight so the hero button is the only loud element |
| Stats | 4 bordered boxes + duplicated "07 LIVE PRODUCTS" label | Hairline-rule band on carbon, big Space Grotesk numerals, count-up on reveal, duplicate label removed |
| Product proof | Generic underline tabs | Numbered vertical rail (desktop) / chip row (mobile) with live preview panel, Live/Beta status pills, key facts column, crossfade on switch |
| Business situations | 2×2 bordered card grid | Numbered hairline rows — hierarchy from type and spacing, not boxes |
| Approach | Four plain columns | Connected timeline (line + dots) as the site's signature pattern |
| Engagement models | Kept — it was the best pattern on the site | Sticky intro column, tightened meta layout |
| Tech stack | Grid of boxes | One mono "Built with" strip |
| Type | Near-uniform sizes, tiny blue eyebrows | 5-step scale (display / h2 / h3 / lead / mono meta), body line-height 1.65 |
| Contrast | `#9d9d9d` small text on black | Small text lifted to `#b4b4b4`+ (AA), body at `#cfcfcf` |
| Motion | None | One restrained reveal (fade + 16px rise, staggered), respects `prefers-reduced-motion` |
| Accents | Blue everywhere | Blue = interactive only; green = live status; amber = beta status |

## Porting to the production app (Vite + React)

The production site is a Vite/React SPA. To port:

1. Copy the CSS custom properties and component styles into the app stylesheet
   (tokens are identical to production, only `--ink-2` and the reveal/motion
   rules are new).
2. The product-proof rail maps 1:1 to the existing product data object
   (`name`, `eyebrow`, `description`, `status`, `heroStats`, product URLs) —
   the `PRODUCTS` array in the inline script mirrors its shape.
3. The reveal observer replaces the existing `reveal-section` class; the
   count-up runs once per stat on first intersection.
4. Images here are the production `/assets/hero-monolith-*.webp` and
   `/assets/products/*-1200.webp` files.
