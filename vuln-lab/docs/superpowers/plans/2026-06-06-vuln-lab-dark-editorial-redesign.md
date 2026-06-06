# Vuln Lab — Dark Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire Vuln Lab static site to a dark-editorial aesthetic (oversized type, generous whitespace, hot-magenta accent, Space Grotesk + Inter) without changing any vulnerability-module logic.

**Architecture:** Pure presentation change to a zero-build vanilla HTML/CSS/ES-modules site. Rewrite `css/styles.css` to a new design-token system; add a font `<link>` and nav markup in `index.html`; extend `js/app.js` so the home route renders a hero + severity-grouped catalog (no sidebar) while bug routes keep a restyled sidebar; add a tiny reveal-on-scroll helper. The 10 `bugs/*.js` modules, `registry.js`, `manifest.js`, and the sandbox/`ui.js` rendering logic are untouched.

**Tech Stack:** HTML5, CSS (custom properties, grid, `clamp()`), vanilla ES modules, Google Fonts (Space Grotesk + Inter), IntersectionObserver.

---

## Verification model (read first)

This project has no unit tests. Each task is verified in the browser against the dev server.

**Start the dev server once (Claude Code Preview):** server name `vuln-lab` (already in `.claude/launch.json`), serves `C:/Users/skyea/test-snake/vuln-lab` on port **8077**. If not running, start it with the Preview tool. Note the returned `serverId`.

**The invariant check (run after every task that touches JS or could affect loading):**

```js
// preview_eval on the vuln-lab serverId
(async () => {
  const b = '?b=' + Date.now();
  const reg = await import('http://localhost:8077/js/registry.js' + b);
  const bugs = await reg.loadBugs();
  const byId = Object.fromEntries(bugs.map(x => [x.id, x]));
  const run = (id, v, p) => byId[id].sandbox.run(v, { patched: p }).verdict;
  return {
    count: bugs.length,                                   // expect 10
    sqli_vuln: run('sql-injection', "' OR '1'='1", false),// expect exploited
    redirect_patched: run('open-redirect', '//evil.x', true), // expect blocked
    csrf_patched: run('csrf', '', true),                  // expect blocked
  };
})()
```

Expected: `{ count: 10, sqli_vuln: "exploited", redirect_patched: "blocked", csrf_patched: "blocked" }`.

**Console check after every task:** `preview_console_logs` with `level: "error"` → expect "No console logs."

**Visual check:** `preview_eval` to set `location.hash` then read DOM, or `preview_screenshot` (note: screenshots may time out in this environment — fall back to DOM assertions via `preview_eval`).

**Cache note:** ES modules are cached. When re-checking JS changes, import with a `?b=<timestamp>` query (as above) or hard-reload (`location.reload()` after a soft nav won't re-fetch modules; a fresh import with a cache-buster will).

All work happens on branch `claude/vuln-lab-security-education-HLabs`. Commit after each task.

---

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `css/styles.css` | All visual styling (tokens + components) | Rewrite, in slices across tasks |
| `index.html` | Document shell, font link, top-nav markup, route-class hook | Modify |
| `js/app.js` | Routing, home hero + severity-grouped catalog, reveal wiring | Modify |
| `js/reveal.js` | IntersectionObserver reveal-on-scroll helper | Create |
| `bugs/*.js`, `js/registry.js`, `js/manifest.js`, `js/ui.js` | Module data + sandbox logic | **Do not change** |

---

## Task 1: Design tokens, base styles, and fonts

**Files:**
- Modify: `index.html` (add font `<link>`s in `<head>`)
- Modify: `css/styles.css:1-40` (`:root` tokens + base `html/body/a/skip-link`)

- [ ] **Step 1: Add Google Fonts to `index.html`**

In `<head>`, immediately after the `<meta name="viewport">` line, add:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Replace the `:root` token block and base styles**

Replace `css/styles.css` lines 1–40 (the `:root {...}` through the `.skip-link:focus` rule) with:

```css
:root {
  --bg: #0a0b0e;
  --bg-elev: #14161b;
  --bg-elev-2: #1b1e26;
  --border: #242833;
  --text: #f3f4f6;
  --text-dim: #98a0ad;

  --accent: #ff5d8f;       /* hot magenta — brand only */
  --accent-dim: #e23f74;   /* hover/active */
  --accent-ink: #1a0710;   /* text on magenta fills */

  --red: #ff6a5d;          /* Critical / exploited */
  --amber: #ffb03a;        /* High / inert */
  --blue: #5cc8ff;         /* Medium */
  --green: #46d07f;        /* Low / blocked / safe */

  --display: "Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --sans: "Inter", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  --radius-card: 12px;
  --radius-ctl: 8px;
  --maxw: 1080px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, .display { font-family: var(--display); letter-spacing: -0.02em; }

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-dim); }

.skip-link {
  position: absolute;
  left: -999px;
  top: 0;
  background: var(--accent);
  color: var(--accent-ink);
  padding: 8px 14px;
  border-radius: var(--radius-ctl);
  font-weight: 700;
  z-index: 50;
}
.skip-link:focus { left: 8px; top: 8px; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 3: Verify base load**

Ensure the dev server `vuln-lab` is running (Preview tool, port 8077). Run `preview_eval`:

```js
(() => {
  const cs = getComputedStyle(document.body);
  return { bg: cs.backgroundColor, font: cs.fontFamily };
})()
```

Expected: `bg` is `rgb(10, 11, 14)`; `font` contains `Inter`.

- [ ] **Step 4: Run the invariant check + console check** (see Verification model). Expect `count: 10`, correct verdicts, no error logs.

- [ ] **Step 5: Commit**

```bash
git add vuln-lab/index.html vuln-lab/css/styles.css
git commit -m "redesign: dark-editorial tokens, base styles, and fonts"
```

---

## Task 2: Top bar / nav

**Files:**
- Modify: `index.html:16-24` (the `.topbar` block)
- Modify: `css/styles.css:42-64` (the `.topbar`/`.brand`/`.tagline` rules)

- [ ] **Step 1: Replace the top-bar markup in `index.html`**

Replace the existing `<header class="topbar">…</header>` (lines 16–24) with:

```html
    <header class="topbar">
      <a class="brand" href="#/">
        <span class="brand-mark" aria-hidden="true">🧪</span>
        <span class="brand-text">Vuln<span class="brand-acc">Lab</span></span>
      </a>
      <nav class="topnav" aria-label="Primary">
        <a class="topnav-link" href="#/">Bugs</a>
        <a class="topnav-link" href="https://github.com/denrod25-del/test-snake/tree/main/vuln-lab" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a class="topnav-cta" href="#/path-traversal">Start →</a>
      </nav>
    </header>
```

- [ ] **Step 2: Replace the top-bar CSS**

Replace `css/styles.css` lines for `.topbar`, `.brand`, `.brand:hover`, `.brand-mark`, `.tagline` with:

```css
/* ---------- Top bar ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 26px;
  border-bottom: 1px solid var(--border);
  background: rgba(10, 11, 14, 0.85);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 20;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--display);
  font-weight: 700;
  font-size: 19px;
  color: var(--text);
  letter-spacing: -0.01em;
}
.brand:hover { color: var(--text); }
.brand-acc { color: var(--accent); }
.brand-mark { font-size: 20px; }

.topnav { display: flex; align-items: center; gap: 20px; }
.topnav-link { color: var(--text-dim); font-size: 14px; font-weight: 500; }
.topnav-link:hover { color: var(--text); }
.topnav-cta {
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  font-size: 13px;
  padding: 8px 15px;
  border-radius: var(--radius-ctl);
}
.topnav-cta:hover { background: var(--accent-dim); color: var(--accent-ink); }

@media (max-width: 560px) {
  .topnav-link { display: none; }
}
```

- [ ] **Step 3: Verify**

`preview_eval`:

```js
(() => ({
  brandAcc: !!document.querySelector('.brand-acc'),
  cta: document.querySelector('.topnav-cta')?.getAttribute('href'),
}))()
```

Expected: `{ brandAcc: true, cta: "#/path-traversal" }`. Then run the console check (no errors).

- [ ] **Step 4: Commit**

```bash
git add vuln-lab/index.html vuln-lab/css/styles.css
git commit -m "redesign: sticky top nav with brand + CTA"
```

---

## Task 3: Route-based layout switch (home = no sidebar)

**Files:**
- Modify: `js/app.js` (`route()` function, ~lines 200-208)
- Modify: `css/styles.css` (the `.layout`/`.sidebar`/`.content` rules + new route rules)

- [ ] **Step 1: Set a body route class in `route()`**

In `js/app.js`, replace the `route()` function with:

```js
function route() {
  const id = currentId();
  const isBug = id && byId.has(id);
  document.body.classList.toggle("route-home", !isBug);
  document.body.classList.toggle("route-bug", !!isBug);
  if (isBug) {
    renderBug(byId.get(id));
  } else {
    renderHome();
  }
  buildNav(filter.value);
}
```

- [ ] **Step 2: Replace the layout CSS with route-aware rules**

Replace the `.layout`, `.sidebar`, `.content`, and the `@media (max-width: 820px)` layout rules with:

```css
/* ---------- Layout ---------- */
.layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  min-height: calc(100vh - 58px);
}
.sidebar {
  border-right: 1px solid var(--border);
  background: var(--bg-elev);
  padding: 18px 14px;
  position: sticky;
  top: 58px;
  height: calc(100vh - 58px);
  overflow-y: auto;
}
.content {
  padding: 0;
  outline: none;
}

/* Home: hide sidebar, content spans full width */
body.route-home .layout { grid-template-columns: 1fr; }
body.route-home .sidebar { display: none; }

/* Bug pages: content gets reading width + padding */
body.route-bug .content {
  padding: 28px 40px 90px;
  max-width: var(--maxw);
}

@media (max-width: 820px) {
  .layout, body.route-home .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  body.route-bug .content { padding: 24px 20px 70px; }
}
```

- [ ] **Step 3: Verify the switch**

`preview_eval`:

```js
(async () => {
  location.hash = '#/';
  await new Promise(r => setTimeout(r, 250));
  const homeSidebar = getComputedStyle(document.querySelector('.sidebar')).display;
  location.hash = '#/sql-injection';
  await new Promise(r => setTimeout(r, 250));
  const bugSidebar = getComputedStyle(document.querySelector('.sidebar')).display;
  const cls = document.body.className;
  location.hash = '#/';
  return { homeSidebar, bugSidebar, cls };
})()
```

Expected: `homeSidebar: "none"`, `bugSidebar: "block"`, and `cls` reflects the last route. Run the invariant + console checks.

- [ ] **Step 4: Commit**

```bash
git add vuln-lab/js/app.js vuln-lab/css/styles.css
git commit -m "redesign: route-driven layout (home full-width, bug pages keep sidebar)"
```

---

## Task 4: Home hero + stat row

**Files:**
- Modify: `js/app.js` (`renderHome()` — the hero portion, ~lines 64-78)
- Modify: `css/styles.css` (replace `.home-hero` rules with new hero styles)

- [ ] **Step 1: Rewrite the hero in `renderHome()`**

In `js/app.js`, replace the hero construction at the top of `renderHome()` (the `const hero = el(...)` block and its `content.appendChild(hero)`) with:

```js
  const hero = el(`
    <header class="hero reveal">
      <p class="eyebrow">Interactive security playground</p>
      <h1 class="hero-title">Break it.<br />Then patch it.</h1>
      <p class="hero-lede">
        Ten classic web vulnerabilities, each a live in-browser simulation.
        Feed it a real exploit, watch it break, then flip one switch and watch
        the fix neutralize the exact same input.
      </p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/path-traversal">Start the lab →</a>
        <a class="btn btn-ghost" href="#catalog">Browse the catalog ↓</a>
      </div>
      <dl class="stats">
        <div class="stat"><dt>10</dt><dd>Vuln modules</dd></div>
        <div class="stat"><dt>100%</dt><dd>Client-side</dd></div>
        <div class="stat"><dt>0</dt><dd>Real systems harmed</dd></div>
      </dl>
    </header>
  `);
  content.appendChild(hero);
```

> Note: the `Browse the catalog ↓` link points to `#catalog`; Task 5 adds `id="catalog"` to the catalog section. The grid built later in `renderHome()` is replaced in Task 5.

- [ ] **Step 2: Replace `.home-hero` CSS with hero + stats styles**

Replace the `.home-hero h1` / `.home-hero p` rules with:

```css
/* ---------- Home hero ---------- */
.hero {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: clamp(40px, 8vw, 84px) 26px 34px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
}
.hero-title {
  font-size: clamp(2.4rem, 6vw, 3.6rem);
  line-height: 0.97;
  letter-spacing: -0.03em;
  font-weight: 700;
  margin: 14px 0 16px;
}
.hero-lede {
  font-size: 16px;
  color: var(--text-dim);
  line-height: 1.55;
  max-width: 56ch;
  margin: 0 0 24px;
}
.hero-cta { display: flex; flex-wrap: wrap; gap: 10px; }
.btn {
  font-weight: 700;
  font-size: 14px;
  padding: 12px 22px;
  border-radius: var(--radius-ctl);
  display: inline-block;
}
.btn-primary { background: var(--accent); color: var(--accent-ink); }
.btn-primary:hover { background: var(--accent-dim); color: var(--accent-ink); }
.btn-ghost { border: 1px solid var(--border); color: var(--text); }
.btn-ghost:hover { border-color: var(--accent); color: var(--text); }

.stats { display: flex; flex-wrap: wrap; gap: 36px; margin: 30px 0 0; }
.stat dt { font-family: var(--display); font-weight: 700; font-size: 26px; }
.stat dd { margin: 2px 0 0; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); }
```

- [ ] **Step 3: Verify**

`preview_eval`:

```js
(async () => {
  location.hash = '#/';
  await new Promise(r => setTimeout(r, 250));
  return {
    title: document.querySelector('.hero-title')?.textContent?.replace(/\s+/g,' ').trim(),
    cta: document.querySelector('.btn-primary')?.getAttribute('href'),
    stats: document.querySelectorAll('.stat').length,
  };
})()
```

Expected: `title` is "Break it.Then patch it." (or with a space), `cta: "#/path-traversal"`, `stats: 3`. Console check: no errors.

- [ ] **Step 4: Commit**

```bash
git add vuln-lab/js/app.js vuln-lab/css/styles.css
git commit -m "redesign: home hero with CTAs and stat row"
```

---

## Task 5: Catalog grid grouped by severity

**Files:**
- Modify: `js/app.js` (`renderHome()` — the catalog/grid portion, ~lines 80-94)
- Modify: `css/styles.css` (replace `.card-grid`/`.card` rules; add section-label + chip styles)

- [ ] **Step 1: Rebuild the catalog in `renderHome()`**

In `js/app.js`, replace the grid construction in `renderHome()` (the `const grid = el(...)` block through its `content.appendChild(grid)`) with:

```js
  const catalog = el(`
    <section class="catalog" id="catalog">
      <div class="section-label">
        <span class="label-l">The catalog</span>
        <span class="label-r">By severity ↓</span>
      </div>
    </section>
  `);
  for (const group of groupBySeverity(BUGS)) {
    const grp = el(`<div class="cat-group reveal"></div>`);
    grp.appendChild(
      el(`<p class="cat-group-label sev-${severityClass(group.severity)}">${escapeHtml(group.severity)} severity</p>`)
    );
    const grid = el(`<div class="card-grid"></div>`);
    for (const bug of group.bugs) {
      const i = BUGS.indexOf(bug) + 1;
      const card = el(`
        <a class="card" href="#/${encodeURIComponent(bug.id)}">
          <div class="card-top">
            <span class="num">${String(i).padStart(2, "0")}</span>
            <span class="badge sev-${severityClass(bug.severity)}">${escapeHtml(bug.severity)}</span>
          </div>
          <h3></h3>
          <p></p>
        </a>
      `);
      card.querySelector("h3").textContent = bug.title;
      card.querySelector("p").textContent = bug.summary;
      grid.appendChild(card);
    }
    grp.appendChild(grid);
    catalog.appendChild(grp);
  }
  content.appendChild(catalog);
```

> `groupBySeverity` and `severityClass` are already imported at the top of `app.js`. Confirm the import line reads:
> `import { el, escapeHtml, codeBlock, sandboxPanel, severityClass } from "./ui.js";`
> and `import { loadBugs, groupBySeverity, SEVERITY_ORDER } from "./registry.js";` — both already present.

- [ ] **Step 2: Replace catalog/card CSS and add chip styles**

Replace the existing `.card-grid`, `.card`, `.card:hover`, `.card h3`, `.card p`, `.card .num` rules with:

```css
/* ---------- Home / catalog ---------- */
.catalog { max-width: var(--maxw); margin: 0 auto; padding: 18px 26px 90px; }
.section-label {
  display: flex; align-items: baseline; justify-content: space-between;
  border-top: 1px solid var(--border); padding-top: 16px; margin-top: 14px;
}
.section-label .label-l,
.section-label .label-r {
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
}
.section-label .label-l { color: var(--text-dim); }
.section-label .label-r { color: var(--accent); }

.cat-group { margin-top: 26px; }
.cat-group-label {
  font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;
  margin: 0 0 12px;
}
.cat-group-label.critical { color: var(--red); }
.cat-group-label.high { color: var(--amber); }
.cat-group-label.medium { color: var(--blue); }
.cat-group-label.low { color: var(--green); }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.card {
  display: block;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  border-radius: var(--radius-card);
  padding: 16px;
  color: var(--text);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card:hover { border-color: var(--accent); color: var(--text); }
.card-top { display: flex; align-items: center; justify-content: space-between; }
.card .num { color: var(--text-dim); font-family: var(--display); font-size: 13px; }
.card h3 { margin: 10px 0 6px; font-size: 16px; font-weight: 600; }
.card p { margin: 0; color: var(--text-dim); font-size: 13px; line-height: 1.45; }

@media (prefers-reduced-motion: no-preference) {
  .card:hover { transform: translateY(-2px); }
}
```

- [ ] **Step 3: Replace the badge/chip CSS to use outlined chips with the new tokens**

Replace the `.badge` and `.sev-*` (badge) rules with:

```css
/* ---------- Severity chips (outlined; never the brand accent) ---------- */
.badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid transparent;
}
.sev-critical { background: rgba(255,106,93,.13);  color: var(--red);   border-color: rgba(255,106,93,.38); }
.sev-high     { background: rgba(255,176,58,.13);  color: var(--amber); border-color: rgba(255,176,58,.38); }
.sev-medium   { background: rgba(92,200,255,.13);  color: var(--blue);  border-color: rgba(92,200,255,.38); }
.sev-low      { background: rgba(70,208,127,.13);  color: var(--green); border-color: rgba(70,208,127,.38); }
```

- [ ] **Step 4: Verify catalog renders grouped**

`preview_eval`:

```js
(async () => {
  location.hash = '#/';
  await new Promise(r => setTimeout(r, 250));
  return {
    catalogId: !!document.getElementById('catalog'),
    groups: document.querySelectorAll('.cat-group').length,         // 1+ (>=2 expected)
    cards: document.querySelectorAll('.card').length,               // 10
    firstGroupLabel: document.querySelector('.cat-group-label')?.textContent,
  };
})()
```

Expected: `catalogId: true`, `cards: 10`, `groups` ≥ 2, `firstGroupLabel` like "High severity" (highest present severity). Run invariant + console checks.

- [ ] **Step 5: Commit**

```bash
git add vuln-lab/js/app.js vuln-lab/css/styles.css
git commit -m "redesign: severity-grouped catalog grid with outlined chips"
```

---

## Task 6: Sidebar restyle (bug pages)

**Files:**
- Modify: `css/styles.css` (`.filter`, `.nav-group-label`, `.nav-item`, `.sidebar-foot`, `.sev-dot`/`.dot-*`)

- [ ] **Step 1: Replace the sidebar CSS**

Replace the `.filter`, `.filter:focus`, `.nav-group-label`, `.nav-item`, `.nav-item:hover`, `.nav-item.active`, `.nav-item .num`, `.nav-item.active .num`, `.sidebar-foot`, `.sev-dot`, `.dot-*` rules with:

```css
/* ---------- Sidebar nav ---------- */
.filter {
  width: 100%;
  padding: 9px 11px;
  margin-bottom: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);
  color: var(--text);
  font-size: 14px;
}
.filter:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
.filter::placeholder { color: var(--text-dim); }

.nav-group-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin: 16px 8px 6px;
  font-weight: 800;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: var(--radius-ctl);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}
.nav-item:hover { background: var(--bg-elev-2); color: var(--text); }
.nav-item.active { background: rgba(255,93,143,.13); color: var(--accent); }
.nav-item .num { color: var(--text-dim); font-family: var(--display); font-size: 12px; font-variant-numeric: tabular-nums; }
.nav-item.active .num { color: var(--accent); }
.nav-item.active .label { font-weight: 600; }

.sidebar-foot {
  margin-top: 22px;
  padding: 12px 8px 0;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
}

.sev-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-critical { background: var(--red); }
.dot-high { background: var(--amber); }
.dot-medium { background: var(--blue); }
.dot-low { background: var(--green); }
```

- [ ] **Step 2: Verify the sidebar on a bug page**

`preview_eval`:

```js
(async () => {
  location.hash = '#/sql-injection';
  await new Promise(r => setTimeout(r, 250));
  const active = document.querySelector('.nav-item.active');
  return {
    navItems: document.querySelectorAll('.nav-item').length,        // 10
    activeColor: active ? getComputedStyle(active).color : null,    // magenta-ish
    activeText: active?.querySelector('.label')?.textContent,
  };
})()
```

Expected: `navItems: 10`, `activeText: "SQL Injection"`, `activeColor` around `rgb(255, 93, 143)`. Console check: no errors.

- [ ] **Step 3: Commit**

```bash
git add vuln-lab/css/styles.css
git commit -m "redesign: restyle bug-page sidebar nav"
```

---

## Task 7: Bug-page chrome — header, sections, prose, code blocks

**Files:**
- Modify: `css/styles.css` (`.bug-head*`, `.section*`, `.prose*`, `.codeblock*`, `.copy-btn`, `.code-pair`)

- [ ] **Step 1: Replace the bug-head + section + prose CSS**

Replace the `.bug-head*`, `.section`, `.section > h2`, `.section > h2 .step-num`, `.prose*` rules with:

```css
/* ---------- Bug page ---------- */
.bug-head { border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 8px; }
.bug-head .crumbs { font-size: 13px; color: var(--text-dim); margin-bottom: 10px; }
.bug-head .crumbs a { color: var(--text-dim); }
.bug-head .crumbs a:hover { color: var(--accent); }
.bug-head h1 {
  margin: 0 0 8px;
  font-size: clamp(1.7rem, 3.5vw, 2.1rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.bug-head .summary { color: var(--text-dim); margin: 8px 0 0; font-size: 15px; max-width: 70ch; }
.bug-head .meta { color: var(--text-dim); font-size: 13px; margin-top: 12px; }

.section { margin-top: 38px; }
.section > h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 14px;
  display: flex; align-items: center; gap: 10px;
}
.section > h2 .step-num {
  display: inline-grid; place-items: center;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--sans);
  font-size: 12px; font-weight: 800;
}
.prose { color: var(--text); }
.prose p { margin: 0 0 12px; }
.prose code { background: var(--bg-elev-2); padding: 1px 6px; border-radius: 5px; font-family: var(--mono); font-size: 13px; }
.prose ul { margin: 0 0 12px; padding-left: 22px; }
.prose li { margin: 5px 0; }
.prose a { color: var(--accent); }
.prose a:hover { color: var(--accent-dim); }
```

- [ ] **Step 2: Replace the code-block CSS**

Replace the `.codeblock*`, `.copy-btn*`, `.code-pair*` rules with:

```css
/* ---------- Code blocks ---------- */
.codeblock {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: #07080b;
  margin: 0;
}
.codeblock .code-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 13px;
  background: var(--bg-elev-2);
  border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600;
  color: var(--text-dim);
}
.codeblock.bad .code-head { color: var(--red); }
.codeblock.good .code-head { color: var(--green); }
.codeblock pre {
  margin: 0; padding: 15px 16px; overflow-x: auto;
  font-family: var(--mono); font-size: 13px; line-height: 1.55;
}
.copy-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 11px;
  cursor: pointer;
}
.copy-btn:hover { color: var(--text); border-color: var(--accent); }

.code-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .code-pair { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify a full bug page renders**

`preview_eval`:

```js
(async () => {
  location.hash = '#/sql-injection';
  await new Promise(r => setTimeout(r, 300));
  return {
    h1: document.querySelector('.bug-head h1 span')?.textContent,
    sections: document.querySelectorAll('.section').length,        // 5
    codeblocks: document.querySelectorAll('.codeblock').length,    // >=2
    stepNum: !!document.querySelector('.step-num'),
  };
})()
```

Expected: `h1: "SQL Injection"`, `sections: 5`, `codeblocks` ≥ 2, `stepNum: true`. Console check: no errors.

- [ ] **Step 4: Commit**

```bash
git add vuln-lab/css/styles.css
git commit -m "redesign: bug-page header, sections, prose, and code blocks"
```

---

## Task 8: Sandbox restyle

**Files:**
- Modify: `css/styles.css` (`.sandbox*`, `.toggle*`, `.run-btn`, `.presets`/`.preset`, `.result*`, `.verdict*`, `.trace*`, `.note`, `.demo-frame*`)

- [ ] **Step 1: Replace the sandbox + result CSS**

Replace everything from the `/* ---------- Sandbox ---------- */` comment through the `.demo-frame .demo-label` rule with:

```css
/* ---------- Sandbox ---------- */
.sandbox {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--bg-elev);
  padding: 18px;
}
.sandbox .toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 14px;
}
.toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg);
}
.toggle button {
  border: 0; background: transparent; color: var(--text-dim);
  padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.toggle button.on.vuln { background: var(--red); color: #1a0707; }
.toggle button.on.safe { background: var(--green); color: #06210d; }

.sandbox label.field-label { font-size: 13px; color: var(--text-dim); display: block; margin-bottom: 6px; }
.sandbox .input-row { display: flex; gap: 8px; }
.sandbox input.payload,
.sandbox textarea.payload {
  flex: 1;
  font-family: var(--mono); font-size: 13px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);
  color: var(--text);
}
.sandbox textarea.payload { resize: vertical; line-height: 1.45; white-space: pre; }
.sandbox input.payload:focus,
.sandbox textarea.payload:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
.run-btn {
  background: var(--accent);
  border: 0;
  color: var(--accent-ink);
  font-weight: 700;
  padding: 10px 20px;
  border-radius: var(--radius-ctl);
  cursor: pointer;
  align-self: flex-start;
}
.run-btn:hover { background: var(--accent-dim); }

.presets { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
.preset {
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: var(--mono);
  cursor: pointer;
}
.preset:hover { color: var(--text); border-color: var(--accent); }

.result { margin-top: 16px; border-top: 1px dashed var(--border); padding-top: 16px; }
.verdict {
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 700; padding: 7px 13px; border-radius: var(--radius-ctl); font-size: 14px;
}
.verdict.exploited { background: rgba(255,106,93,.14); color: var(--red); }
.verdict.blocked   { background: rgba(70,208,127,.14); color: var(--green); }
.verdict.safe      { background: rgba(70,208,127,.14); color: var(--green); }
.verdict.inert     { background: rgba(255,176,58,.14); color: var(--amber); }

.trace { margin-top: 14px; border: 1px solid var(--border); border-radius: var(--radius-ctl); overflow: hidden; }
.trace-row { display: grid; grid-template-columns: 200px 1fr; border-top: 1px solid var(--border); }
.trace-row:first-child { border-top: 0; }
.trace-row .k { background: var(--bg-elev-2); padding: 9px 12px; font-size: 12px; color: var(--text-dim); }
.trace-row .v { padding: 9px 12px; font-family: var(--mono); font-size: 13px; white-space: pre-wrap; word-break: break-all; }
.trace-row .v.flag-bad { color: var(--red); }
.trace-row .v.flag-good { color: var(--green); }
@media (max-width: 600px) { .trace-row { grid-template-columns: 1fr; } }

.result .note {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-dim);
  background: var(--bg-elev-2);
  border-left: 3px solid var(--accent);
  padding: 9px 13px;
  border-radius: 0 var(--radius-ctl) var(--radius-ctl) 0;
}

.demo-frame { margin-top: 14px; }
.demo-frame iframe {
  width: 100%; min-height: 120px;
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);
  background: #fff;
}
.demo-frame .demo-label { font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
```

- [ ] **Step 2: Verify the sandbox works end-to-end via the UI**

`preview_eval` (clicks a preset, which calls the real `run()` and renders):

```js
(async () => {
  location.hash = '#/redos';
  await new Promise(r => setTimeout(r, 300));
  const hang = [...document.querySelectorAll('.preset')].find(p => /hangs/.test(p.textContent));
  hang.click();
  await new Promise(r => setTimeout(r, 200));
  return {
    verdict: document.querySelector('.result .verdict')?.textContent?.trim(),
    runBtnBg: getComputedStyle(document.querySelector('.run-btn')).backgroundColor,
    traceRows: document.querySelectorAll('.trace-row').length,
  };
})()
```

Expected: `verdict` contains "Exploited", `runBtnBg` ≈ `rgb(255, 93, 143)`, `traceRows` ≥ 4. Run invariant + console checks.

- [ ] **Step 3: Commit**

```bash
git add vuln-lab/css/styles.css
git commit -m "redesign: restyle sandbox, toggle, presets, trace, and verdict"
```

---

## Task 9: Reveal-on-scroll motion

**Files:**
- Create: `js/reveal.js`
- Modify: `js/app.js` (import + call after each render)
- Modify: `css/styles.css` (add `.reveal` / `.reveal.in` rules)

- [ ] **Step 1: Create `js/reveal.js`**

```js
/**
 * Reveal-on-scroll: fades+rises elements tagged `.reveal` as they enter view.
 * No-ops (elements shown immediately) when the user prefers reduced motion or
 * IntersectionObserver is unavailable.
 */
export function revealOnScroll(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof IntersectionObserver === "undefined") {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        obs.unobserve(e.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  els.forEach((el) => io.observe(el));
}
```

- [ ] **Step 2: Wire it into `app.js`**

Add to the imports at the top of `js/app.js`:

```js
import { revealOnScroll } from "./reveal.js";
```

Then at the END of both `renderHome()` and `renderBug()` (just before each function returns / after the final `content.appendChild`/`content.scrollTop = 0`), add:

```js
  revealOnScroll(content);
```

For `renderBug()`, also tag the sections: in `renderBug()`, after `const head = el(...)`, the head and each `section(...)` should get the class. Simplest: after building, add the class to all top-level blocks. Replace the final lines of `renderBug()`:

```js
  content.querySelectorAll(":scope > .section, :scope > .bug-head").forEach((n) => n.classList.add("reveal"));
  revealOnScroll(content);
  content.focus();
  content.scrollTop = 0;
```

- [ ] **Step 3: Add the reveal CSS**

Append to `css/styles.css`:

```css
/* ---------- Reveal-on-scroll ---------- */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease, transform 0.5s ease; }
  .reveal.in { opacity: 1; transform: none; }
}
```

- [ ] **Step 4: Verify reveal applies and resolves**

`preview_eval`:

```js
(async () => {
  location.hash = '#/';
  await new Promise(r => setTimeout(r, 500));
  const reveals = document.querySelectorAll('.reveal');
  const inCount = document.querySelectorAll('.reveal.in').length;
  return { reveals: reveals.length, inCount, allResolvedOrAnimating: reveals.length > 0 };
})()
```

Expected: `reveals` ≥ 2; `inCount` ≥ 1 (the hero, which is in view, has resolved). Run invariant + console checks.

- [ ] **Step 5: Commit**

```bash
git add vuln-lab/js/reveal.js vuln-lab/js/app.js vuln-lab/css/styles.css
git commit -m "redesign: subtle reveal-on-scroll (respects reduced-motion)"
```

---

## Task 10: Responsive + accessibility pass, full sweep, README note

**Files:**
- Modify: `css/styles.css` (add `.notfound` token color if needed; verify breakpoints)
- Modify: `vuln-lab/README.md` (one line noting the redesign)

- [ ] **Step 1: Ensure the not-found state uses tokens**

Confirm/replace the `.notfound` rule:

```css
.notfound { text-align: center; padding: 70px 0; color: var(--text-dim); }
```

- [ ] **Step 2: Add a redesign note to `README.md`**

Under the `## Tech stack` section in `vuln-lab/README.md`, append:

```markdown

The UI uses a dark-editorial theme (Space Grotesk + Inter, hot-magenta accent).
Fonts load from Google Fonts; everything else is local and build-free.
```

- [ ] **Step 3: Responsive sweep at three widths**

`preview_eval` (resizes the viewport via the preview, or use `preview_resize` if available; otherwise assert grid columns by computed style):

```js
(async () => {
  location.hash = '#/';
  await new Promise(r => setTimeout(r, 250));
  const grid = document.querySelector('.card-grid');
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  location.hash = '#/sql-injection';
  await new Promise(r => setTimeout(r, 250));
  const sidebarVisible = getComputedStyle(document.querySelector('.sidebar')).display !== 'none';
  return { homeGridCols: cols, bugSidebarVisible: sidebarVisible };
})()
```

Expected (desktop width): `homeGridCols` ≥ 2, `bugSidebarVisible: true`. (Manually spot-check a narrow window: cards collapse toward 1 column; sidebar stacks above content.)

- [ ] **Step 4: Reduced-motion check**

`preview_eval`:

```js
(() => {
  // Confirm the rule exists and reveal elements end up visible regardless.
  const anyHidden = [...document.querySelectorAll('.reveal')].some(el => getComputedStyle(el).opacity === '0' && !el.classList.contains('in'));
  return { note: 'inspect manually with OS reduced-motion on', anyPermanentlyHidden: anyHidden };
})()
```

Expected: `anyPermanentlyHidden: false` for elements in view. (With OS reduced-motion enabled, `revealOnScroll` adds `.in` immediately and the `.reveal` opacity rule is disabled by the media query.)

- [ ] **Step 5: Final full sweep across all 10 modules**

`preview_eval`:

```js
(async () => {
  const b = '?b=' + Date.now();
  const reg = await import('http://localhost:8077/js/registry.js' + b);
  const bugs = await reg.loadBugs();
  const ids = bugs.map(x => x.id);
  let errors = 0;
  for (const bug of bugs) {
    for (const p of [false, true]) {
      for (const inp of ['', 'x', ...(bug.sandbox?.presets||[]).map(o => o.value)]) {
        try {
          const r = bug.sandbox.run(inp, { patched: p });
          if (!['exploited','blocked','safe','inert'].includes(r.verdict)) errors++;
        } catch { errors++; }
      }
    }
  }
  return { count: bugs.length, ids, errors };
})()
```

Expected: `count: 10`, all ids present, `errors: 0`. Then `preview_console_logs` (`level: "error"`) → "No console logs."

- [ ] **Step 6: Commit**

```bash
git add vuln-lab/css/styles.css vuln-lab/README.md
git commit -m "redesign: responsive/a11y polish + README note"
```

---

## Task 11: Push and update PR

- [ ] **Step 1: Push the branch**

```bash
git push origin claude/vuln-lab-security-education-HLabs
```

- [ ] **Step 2: Add a PR comment summarizing the redesign**

```bash
gh pr comment 2 --body "Added a whole-site dark-editorial redesign (Space Grotesk + Inter, hot-magenta accent, editorial landing + restyled bug pages). Presentation only — all 10 module sandboxes verified unchanged (correct verdicts, no console errors)."
```

Expected: command prints the comment URL.

---

## Self-review (completed during planning)

- **Spec coverage:** tokens/fonts (T1) · top nav (T2) · L2 layout switch (T3) · hero+stats (T4) · severity-grouped catalog + outlined chips (T5) · sidebar (T6) · bug-page chrome + code blocks (T7) · sandbox/trace/verdict (T8) · reveal-on-scroll + reduced-motion (T9) · responsive + a11y + non-goals preserved (T10) · ship (T11). All spec sections map to a task.
- **No-logic-change guarantee:** only `index.html`, `css/styles.css`, `js/app.js`, and new `js/reveal.js` are modified; `bugs/*.js`, `registry.js`, `manifest.js`, `ui.js` are untouched. The invariant check in every task re-runs the real `loadBugs()`/`run()` to prove sandbox behavior is unchanged.
- **Type/name consistency:** `severityClass`, `groupBySeverity`, `escapeHtml`, `el` are existing exports already imported in `app.js`; `revealOnScroll` is defined in T9 before use; CSS class names (`.hero`, `.catalog#catalog`, `.cat-group`, `.card-top`, `.btn-primary`) are introduced and styled in the same tasks that emit them.
- **Placeholder scan:** every code/CSS step contains complete content; no TBD/TODO.
