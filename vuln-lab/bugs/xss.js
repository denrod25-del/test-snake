/**
 * Bug module: Cross-Site Scripting (XSS)
 *
 * This is the first module to use the live-render demo hook: run() returns a
 * `demo` iframe whose srcdoc is a tiny "guestbook" mini-app. The VULNERABLE
 * frame assigns the user's input to element.innerHTML (markup is parsed and
 * event-handler payloads fire); the PATCHED frame assigns it to
 * element.textContent (markup is shown as literal characters). The iframe is
 * rendered by ui.js with sandbox="allow-scripts" and NO allow-same-origin, so
 * payloads genuinely execute but are jailed to an opaque origin — they cannot
 * touch this page, its cookies, or storage.
 */

// ---- Safely inline attacker input into the harness's inline <script> --------
// JSON.stringify gives us a valid JS string literal; then we escape "<"/">"/"&"
// to their \uXXXX forms so the HTML parser never sees a literal "</script>" and
// the payload can't break out of the harness script itself. (This neutralizing
// step is, fittingly, exactly how you safely embed data in an inline script.)
function embedJsString(s) {
  return JSON.stringify(s)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Build the mini-app the iframe renders. The ONLY difference between the two
// modes is the sink: innerHTML (vulnerable) vs textContent (patched).
function buildFrame(input, patched) {
  const sink = patched ? "textContent" : "innerHTML";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px/1.5 system-ui,sans-serif;margin:10px;color:#111}
    .card{border:1px solid #d0d7de;border-radius:8px;padding:10px 12px;background:#fff}
    h3{margin:.1em 0 .4em}
    .lbl{color:#57606a;font-size:12px}
    #out{margin-top:4px;min-height:1.4em}
    mark{background:#ffd000}
  </style></head><body>
    <script>window.SESSION = "sess_7f3a9c21";<\/script>
    <div class="card">
      <h3>📖 Guestbook</h3>
      <div class="lbl">Latest comment, as rendered by the page:</div>
      <div id="out"></div>
    </div>
    <script>
      // ${patched ? "PATCHED: input assigned as TEXT — markup is not parsed" : "VULNERABLE: input assigned as HTML — markup is parsed & runs"}
      var INPUT = ${embedJsString(input)};
      document.getElementById("out").${sink} = INPUT;
    <\/script>
  </body></html>`;
}

// ---- Static classification of the payload (for the trace) -------------------
// Mirrors what the browser actually does when the input is assigned to
// innerHTML, so the trace never contradicts the live frame:
//   - a "<" is only a tag when followed by a letter, "!", "?", or "/"
//     (so "5 > 3" or "a < b" is plain text, not injected markup);
//   - of the inline handlers, onerror reliably FIRES via innerHTML (a broken
//     <img>/<video> dispatches error synchronously-ish), whereas onload /
//     <script> do NOT run when parsed from innerHTML — they only fire when a
//     server reflects them into the document at page-load time;
//   - a javascript: URI executes when the injected link is clicked.
function classify(input) {
  const TAG = /<[a-zA-Z!/?]/;
  const hasTag = TAG.test(input);
  const autoFires = /\bonerror\s*=/i.test(input); // fires on innerHTML insertion
  const handler = /\bon\w+\s*=/i.test(input); // any inline event handler
  const jsUri = /javascript:/i.test(input); // runs on click/navigation
  const scriptTag = /<script\b/i.test(input);
  // Markup other than a <script> element (i.e. something that actually renders
  // or carries a vector) — used to tell "defacement" from an inert <script>.
  const otherMarkup = TAG.test(input.replace(/<\/?script\b[^>]*>/gi, ""));
  return { hasTag, autoFires, handler, jsUri, scriptTag, otherMarkup };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "xss",
  title: "Cross-Site Scripting (XSS)",
  severity: "High",
  category: "Injection",
  cwe: "CWE-79",
  summary:
    "Reflecting untrusted input into a page as HTML lets an attacker run JavaScript in your users' browsers — stealing sessions, keys, or acting as them.",

  explanation: `
    <p>Cross-site scripting happens when an application takes untrusted input and
    drops it into a page where the browser parses it as <strong>HTML or
    JavaScript</strong> instead of plain text. The browser can't tell that the
    comment, username, or URL parameter was supposed to be <em>data</em> — if it
    looks like markup, it gets parsed like markup.</p>
    <p>The instant a value containing <code>&lt;img src=x onerror=…&gt;</code>
    reaches a sink like <code>element.innerHTML</code> (or an unescaped server
    template emits <code>&lt;svg onload=…&gt;</code> into the page), the
    attacker's JavaScript runs <strong>in the victim's session, on your
    origin</strong>. From there it can read cookies and tokens, make
    authenticated requests as the user, keylog, or rewrite the page (fake
    logins).</p>
    <p>It comes in three flavors: <strong>reflected</strong> (payload echoed from
    the request), <strong>stored</strong> (payload saved and served to others —
    the worst), and <strong>DOM-based</strong> (client-side JS feeds input into a
    sink). One nuance worth knowing: how a payload fires depends on the sink. A
    bare <code>&lt;script&gt;</code> — and handlers like
    <code>&lt;svg onload&gt;</code> — execute when a <em>server</em> reflects
    them into the page and the HTML parser runs at load time, but do
    <em>not</em> run when assigned through <code>innerHTML</code>. An
    <code>&lt;img src=x onerror&gt;</code>, by contrast, fires even via
    <code>innerHTML</code> — which is why blocklisting the word "script" is
    never enough.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — input rendered as HTML",
    code: `// DOM-based: assigning user input to innerHTML parses it as markup
const comment = new URL(location).searchParams.get("comment");
out.innerHTML = comment;          // ❌ <img onerror>, <svg onload> fire here

// Reflected (server-side): raw interpolation into the HTML response
app.get("/guestbook", (req, res) => {
  res.send(\`<div class="comment">\${req.query.comment}</div>\`); // ❌ no escaping
});`,
  },

  fixExplanation: `
    <p>Treat untrusted input as <strong>data, not markup</strong>, and encode it
    for the exact context it lands in. On the client, assign to
    <code>textContent</code> (or set attributes via <code>setAttribute</code>) —
    never <code>innerHTML</code>. On the server, use a template engine with
    <strong>automatic contextual escaping</strong> (React JSX, Handlebars
    <code>{{ }}</code>, Jinja2 autoescape) so values are HTML-encoded by default.</p>
    <p>If you genuinely must allow <em>some</em> HTML (rich text), sanitize it with
    a vetted library like <strong>DOMPurify</strong> — don't write your own
    blocklist. Add a <strong>Content-Security-Policy</strong> as defense in depth
    so injected inline scripts won't run even if something slips through, and set
    <code>HttpOnly</code> on session cookies so script can't read them.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — input rendered as text / escaped",
    code: `// DOM-based: assign as text — the browser never parses it as markup
out.textContent = comment;        // ✅ "<img onerror=…>" shows as literal text

// Server-side: contextual auto-escaping (or escape explicitly)
app.get("/guestbook", (req, res) => {
  // res.render uses an auto-escaping template; or, by hand:
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  res.send(\`<div class="comment">\${esc(req.query.comment)}</div>\`); // ✅
});
// + Content-Security-Policy and HttpOnly cookies as defense in depth.`,
  },

  sandbox: {
    intro: `
      <p>This is a live guestbook: your input is rendered into the page below, in
      a <strong>sandboxed iframe</strong> (scripts allowed, but jailed to an
      opaque origin — it can't touch this page). In <em>Vulnerable</em> mode the
      comment is assigned to <code>innerHTML</code>; flip to <em>Patched</em> and
      the same payload is assigned to <code>textContent</code> and rendered as
      harmless text. The frame contains a fake <code>window.SESSION</code> token so
      you can watch a payload steal it.</p>
    `,
    inputLabel: "Guestbook comment",
    placeholder: "Write a comment… or a payload",
    default: "Hello! 😀",
    presets: [
      { label: "benign comment", value: "Hello! 😀" },
      { label: "HTML injection: <b>", value: "<b>injected markup</b>" },
      { label: "auto-fire via onerror", value: "<img src=x onerror=\"out.innerHTML='💥 XSS executed'\">" },
      { label: "click vector (javascript:)", value: "<a href=\"javascript:out.innerHTML='💥 clicked: code ran'\">click me</a>" },
      { label: "steal session token", value: "<img src=x onerror=\"out.innerHTML='💀 stole token: '+window.SESSION\">" },
      { label: "<script> (won't run via innerHTML)", value: "<script>out.innerHTML='ran'</script>" },
    ],

    run(input, { patched }) {
      input = typeof input === "string" ? input : String(input);
      const c = classify(input);

      // Classify what the vulnerable (innerHTML) sink would actually do, so the
      // verdict and the live frame always agree:
      //   executes  → code runs (now, or on click)        → exploited
      //   defaced   → visible HTML injected, no code       → exploited
      //   inert     → only a <script>, which innerHTML won't run, nothing shown
      //   (no tag)  → plain text                           → safe
      const executes = c.autoFires || c.handler || c.jsUri;
      const defaced = c.otherMarkup && !c.autoFires && !c.handler && !c.jsUri;
      const vulnVerdict = !c.hasTag ? "safe" : executes || defaced ? "exploited" : "inert";

      const sinkStep = patched
        ? { label: "Sink", value: "out.textContent = input", flag: "good" }
        : { label: "Sink", value: "out.innerHTML = input", flag: "bad" };

      const parsedStep = patched
        ? { label: "Browser parses input as", value: "text — markup is shown literally, not interpreted" }
        : { label: "Browser parses input as", value: "HTML — markup is parsed and rendered", flag: c.hasTag ? "bad" : undefined };

      const vectorValue = !c.hasTag
        ? "none — plain text"
        : c.autoFires
        ? "yes — onerror handler runs JavaScript on render (broken image)"
        : c.jsUri
        ? "javascript: URI — runs JavaScript when the link is clicked"
        : c.handler
        ? "inline event handler — runs JavaScript on user interaction (e.g. click)"
        : c.scriptTag && !c.otherMarkup
        ? "<script> only — injected, but innerHTML does NOT execute it"
        : "HTML injected (renders, but no script vector)";

      const vectorStep = {
        label: "Active vector",
        value: vectorValue,
        flag: patched ? "good" : c.hasTag ? "bad" : undefined,
      };

      const steps = [
        { label: "Your input", value: input || "(empty)" },
        sinkStep,
        parsedStep,
        vectorStep,
      ];

      const demo = {
        type: "iframe",
        label: patched ? "Live render — patched (textContent)" : "Live render — vulnerable (innerHTML)",
        srcdoc: buildFrame(input, patched),
      };

      if (patched) {
        return {
          verdict: c.hasTag ? "blocked" : "safe",
          steps,
          demo,
          note: c.hasTag
            ? "Same payload, neutralized: textContent stores the value as a literal text " +
              "node — the browser never parses it as markup, so there is nothing to escape " +
              "and nothing runs. Look at the frame: the tags appear as visible text."
            : "Plain text with no markup — rendered safely either way.",
        };
      }

      const note = !c.hasTag
        ? "Plain text, no markup — nothing was injected this time. But the same sink " +
          "(innerHTML) will parse any markup you give it; try a payload preset."
        : c.autoFires
        ? "JavaScript executed inside the page on render — see the frame. Against a real " +
          "victim this runs on your origin in their session: reading cookies/tokens, acting " +
          "as them, or defacing the page. (Here it is jailed to the sandboxed iframe.)"
        : c.jsUri || c.handler
        ? "A working vector was injected — it runs when the victim interacts (clicking the " +
          "link / element). Click it in the frame to fire it. Same impact as an auto-firing " +
          "payload, just one interaction away."
        : c.scriptTag && !c.otherMarkup
        ? "The <script> was injected into the DOM, but a <script> added via innerHTML does " +
          "NOT execute — which is exactly why blocklisting the word 'script' is useless. The " +
          "sink is still vulnerable; switch to the onerror preset to see code actually run. " +
          "(<script> and <svg onload> only fire when a server reflects them into the page " +
          "at parse time, not through this innerHTML sink.)"
        : "Arbitrary HTML was injected into the page (defacement, fake login forms, phishing) — " +
          "this is XSS even without code execution.";

      return { verdict: vulnVerdict, steps, demo, note };
    },
  },

  references: [
    { label: "OWASP — Cross Site Scripting (XSS)", url: "https://owasp.org/www-community/attacks/xss/" },
    { label: "OWASP — XSS Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html" },
    { label: "PortSwigger — Cross-site scripting", url: "https://portswigger.net/web-security/cross-site-scripting" },
    { label: "CWE-79 — Improper Neutralization of Input During Web Page Generation", url: "https://cwe.mitre.org/data/definitions/79.html" },
  ],
};
