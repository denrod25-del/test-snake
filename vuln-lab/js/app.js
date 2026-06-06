/**
 * App shell: loads the registry, builds the sidebar, and routes between the
 * home catalog and individual bug pages via the URL hash (#/bug-id).
 */
import { loadBugs, groupBySeverity, SEVERITY_ORDER } from "./registry.js";
import { el, escapeHtml, codeBlock, sandboxPanel, severityClass } from "./ui.js";

const navList = document.getElementById("nav-list");
const content = document.getElementById("main");
const filter = document.getElementById("filter");

let BUGS = [];
let byId = new Map();

function currentId() {
  const m = location.hash.match(/^#\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null; // malformed percent-escape (e.g. "#/%") → fall back to home
  }
}

/* ---------- Sidebar ---------- */
function buildNav(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const visible = q
    ? BUGS.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.summary.toLowerCase().includes(q) ||
          (b.category || "").toLowerCase().includes(q)
      )
    : BUGS;

  navList.innerHTML = "";
  const groups = groupBySeverity(visible);
  if (!groups.length) {
    navList.appendChild(el(`<p class="nav-group-label">No matches</p>`));
    return;
  }
  for (const group of groups) {
    navList.appendChild(
      el(`<p class="nav-group-label">${escapeHtml(group.severity)} severity</p>`)
    );
    for (const bug of group.bugs) {
      const n = BUGS.indexOf(bug) + 1;
      const item = el(`
        <a class="nav-item" href="#/${encodeURIComponent(bug.id)}">
          <span class="sev-dot dot-${severityClass(bug.severity)}"></span>
          <span class="num">${String(n).padStart(2, "0")}</span>
          <span class="label"></span>
        </a>
      `);
      item.querySelector(".label").textContent = bug.title;
      if (bug.id === currentId()) item.classList.add("active");
      navList.appendChild(item);
    }
  }
}

/* ---------- Home / catalog ---------- */
function renderHome() {
  content.innerHTML = "";
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
      el(`<p class="cat-group-label ${severityClass(group.severity)}">${escapeHtml(group.severity)} severity</p>`)
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
}

/* ---------- Bug page ---------- */
function section(title, stepNum) {
  const s = el(`<section class="section"><h2></h2></section>`);
  const h = s.querySelector("h2");
  if (stepNum != null) h.appendChild(el(`<span class="step-num">${stepNum}</span>`));
  h.appendChild(document.createTextNode(title));
  return s;
}

function renderBug(bug) {
  content.innerHTML = "";

  const head = el(`
    <div class="bug-head">
      <div class="crumbs"><a href="#/">Vuln Lab</a> › ${escapeHtml(bug.title)}</div>
      <h1>
        <span></span>
        <span class="badge sev-${severityClass(bug.severity)}">${escapeHtml(bug.severity)}</span>
      </h1>
      <p class="summary"></p>
      <p class="meta"></p>
    </div>
  `);
  head.querySelector("h1 span").textContent = bug.title;
  head.querySelector(".summary").textContent = bug.summary;
  head.querySelector(".meta").textContent =
    [bug.category && `Category: ${bug.category}`, bug.cwe && `CWE: ${bug.cwe}`]
      .filter(Boolean)
      .join("  ·  ");
  content.appendChild(head);

  // 1. Why it happens
  if (bug.explanation) {
    const s = section("Why it happens", 1);
    const prose = el(`<div class="prose"></div>`);
    prose.innerHTML = bug.explanation; // authored, trusted content
    s.appendChild(prose);
    content.appendChild(s);
  }

  // 2. Vulnerable code
  if (bug.vulnerable) {
    const s = section("The vulnerable pattern", 2);
    s.appendChild(
      codeBlock(bug.vulnerable.code, {
        lang: bug.vulnerable.lang,
        label: bug.vulnerable.label || "Vulnerable",
        variant: "bad",
      })
    );
    content.appendChild(s);
  }

  // 3. Sandbox
  if (bug.sandbox) {
    const s = section("Try it: live sandbox", 3);
    if (bug.sandbox.intro) {
      const intro = el(`<div class="prose"></div>`);
      intro.innerHTML = bug.sandbox.intro;
      s.appendChild(intro);
    }
    s.appendChild(sandboxPanel(bug.sandbox));
    content.appendChild(s);
  }

  // 4. The fix
  if (bug.patched) {
    const s = section("The fix", 4);
    if (bug.fixExplanation) {
      const prose = el(`<div class="prose"></div>`);
      prose.innerHTML = bug.fixExplanation;
      s.appendChild(prose);
    }
    s.appendChild(
      codeBlock(bug.patched.code, {
        lang: bug.patched.lang,
        label: bug.patched.label || "Patched",
        variant: "good",
      })
    );
    content.appendChild(s);
  }

  // References
  if (bug.references && bug.references.length) {
    const s = section("References", null);
    const ul = el(`<ul class="refs"></ul>`);
    for (const r of bug.references) {
      const li = el(`<li><a target="_blank" rel="noopener noreferrer"></a></li>`);
      const a = li.querySelector("a");
      a.href = r.url;
      a.textContent = r.label;
      ul.appendChild(li);
    }
    s.appendChild(ul);
    content.appendChild(s);
  }

  content.focus();
  content.scrollTop = 0;
}

/* ---------- Router ---------- */
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

async function init() {
  content.innerHTML = `<p class="notfound">Loading lab…</p>`;
  BUGS = await loadBugs();
  // Stable display order: by severity, then manifest order within severity.
  BUGS.sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  byId = new Map(BUGS.map((b) => [b.id, b]));

  if (!BUGS.length) {
    content.innerHTML = `<p class="notfound">No bug modules loaded. Check <code>js/manifest.js</code>.</p>`;
    return;
  }

  filter.addEventListener("input", () => buildNav(filter.value));
  window.addEventListener("hashchange", route);
  route();
}

init();
