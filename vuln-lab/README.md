# 🧪 Vuln Lab

An interactive, **fully client-side** playground for learning how classic
security vulnerabilities work — and how to defend against them.

Every sandbox is a **simulation**: a fake vulnerable function written in plain
JavaScript that runs against your input in the browser. No real systems are
ever attacked, and there is no backend. It deploys to any static host as-is.

For each bug you get:

1. **Why it happens** — a plain-English explanation.
2. **The vulnerable pattern** — the bad code, annotated.
3. **A live sandbox** — feed it malicious input, watch the mini-app break, then
   flip the **Vulnerable ⟷ Patched** toggle to watch the fix neutralize the
   *same* input.
4. **The fix** — patched code with an explanation.

## Run locally

It's static — just serve the folder:

```bash
cd vuln-lab
python -m http.server 8000
# open http://localhost:8000/
```

(ES modules require `http://`, so opening `index.html` via `file://` won't work.)

## Tech stack

Zero build step. Plain HTML + CSS + vanilla ES modules. No framework, no
bundler, no dependencies.

## Project layout

```
vuln-lab/
  index.html          App shell (sidebar + content pane)
  css/styles.css      Dark "lab" theme
  js/
    manifest.js       ← The one list you append to when adding a bug
    registry.js       Loads + validates modules from the manifest
    ui.js             Generic renderers (code blocks, sandbox, result trace)
    app.js            Hash router (#/bug-id) + page assembly
  bugs/
    path-traversal.js The first, fully-built module
    _TEMPLATE.js      Copy-paste starter (files starting with _ are ignored)
```

## Adding a new bug (e.g. bug #11)

The architecture is data-driven so adding a bug is a **two-step** change that
touches no existing module:

1. Copy `bugs/_TEMPLATE.js` → `bugs/<your-bug-id>.js` and fill in the fields.
2. Add `"../bugs/<your-bug-id>.js"` to the array in `js/manifest.js`.

That's it. The sidebar, routing, severity grouping, code blocks, and sandbox
wiring all happen automatically.

### The bug-module contract

Each module `export default`s one object:

| Field            | Required | Purpose                                                   |
| ---------------- | -------- | --------------------------------------------------------- |
| `id`             | ✅       | Unique, URL-safe; becomes the `#/id` route                |
| `title`          | ✅       | Display name                                              |
| `severity`       | ✅       | `Critical` \| `High` \| `Medium` \| `Low`                 |
| `summary`        | ✅       | One-line hook                                             |
| `category`,`cwe` |          | Metadata shown in the header                              |
| `explanation`    |          | "Why it happens" (trusted authored HTML)                  |
| `vulnerable`     |          | `{ code, lang, label }` — the bad pattern                 |
| `fixExplanation` |          | HTML describing the fix                                   |
| `patched`        |          | `{ code, lang, label }` — the safe pattern                |
| `references`     |          | `[{ label, url }]`                                        |
| `sandbox`        |          | The interactive simulation (see below)                    |

The **sandbox** is where the learning happens:

```js
sandbox: {
  intro, inputLabel, placeholder, default,
  presets: [{ label, value }],          // one-click malicious inputs
  run(input, { patched }) {             // a PURE function — the simulation
    return {
      verdict: "exploited" | "blocked" | "safe",
      steps: [{ label, value, flag?: "bad" | "good" }],  // execution trace
      note,                                              // optional footnote
      demo: { type: "iframe", srcdoc, label },           // optional rendered output
    };
  }
}
```

`run()` is called with the same input in both modes — that's what makes the
toggle a true before/after comparison. The optional `demo` iframe runs
`sandbox="allow-scripts"` only (no same-origin), so payload-rendering demos like
XSS can genuinely fire while staying jailed.

## Status

- ✅ Scaffold + architecture
- ✅ #1 Path Traversal / Zip Slip
- ✅ #2 SQL Injection
- ✅ #3 Cross-Site Scripting (XSS) — live sandboxed-iframe demo
- ✅ #4 OS Command Injection — mock shell (operators, substitution)
- ✅ #5 Server-Side Request Forgery (SSRF) — mock network (DNS + IP zones)
- ✅ #6 XML External Entity (XXE) — mock XML/DTD engine (multiline input)
- ⬜ Insecure Deserialization, CSRF, Open Redirect, ReDoS

## Disclaimer

For **defensive education only**. The sandboxes are deliberately simplified
simulations meant to build intuition about vulnerability classes and their
fixes — not attack tools.
