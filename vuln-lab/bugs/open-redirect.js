/**
 * Bug module: Open Redirect (Unvalidated Redirect)
 *
 * Self-contained. The sandbox simulates a "/login?next=…" flow: after sign-in
 * the app bounces the user to the URL in `next`. If that value is reflected into
 * a redirect without validation, an attacker can point it off-site — a clean
 * phishing primitive (your real domain in the link, the victim lands on theirs)
 * and, with a `javascript:` URL, sometimes a path to XSS.
 *
 * The simulation resolves the target the way a browser actually would, via
 * new URL(value, base), so the famous bypasses behave correctly:
 *   //evil.com        -> protocol-relative, goes off-site
 *   /\evil.com        -> backslashes normalize to //, goes off-site
 *   (tab)//evil.com   -> a leading control char is stripped, then protocol-relative -> off-site
 *   https://trusted.app.evil.com   -> suffix trick, off-site
 *   https://trusted.app@evil.com   -> userinfo trick, host is evil.com
 *   javascript:...    -> not an http(s) navigation at all
 * The PATCHED validator allow-lists *local relative paths only* (and could add an
 * explicit host allow-list), which is what neutralizes every case above.
 */

// The origin the app itself lives on. A redirect that lands anywhere else is
// "off-site". Using a real URL base lets the browser's own parser decide.
const APP_ORIGIN = "https://trusted.app";
const SAFE_FALLBACK = "/dashboard";

// Schemes that don't represent a normal same-site navigation. javascript:/data:
// are actively dangerous; mailto:/etc. are just not redirect targets.
const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

/**
 * Resolve `value` against the app origin exactly like res.redirect()/the browser
 * would, and classify where it actually lands.
 * Returns { kind: 'offsite'|'dangerous'|'onsite'|'invalid', href, host, scheme }.
 */
function resolveTarget(value) {
  const raw = String(value);

  // A bare scheme like "javascript:alert(1)" — catch before URL() so we report it
  // as dangerous rather than as some host.
  const schemeMatch = raw.trim().match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch && DANGEROUS_SCHEMES.has(schemeMatch[1].toLowerCase() + ":")) {
    return { kind: "dangerous", href: raw.trim(), host: null, scheme: schemeMatch[1].toLowerCase() + ":" };
  }

  let u;
  try {
    u = new URL(raw, APP_ORIGIN); // relative values resolve against our origin
  } catch {
    return { kind: "invalid", href: raw, host: null, scheme: null };
  }

  if (DANGEROUS_SCHEMES.has(u.protocol)) {
    return { kind: "dangerous", href: u.href, host: null, scheme: u.protocol };
  }
  if (u.origin === APP_ORIGIN) {
    return { kind: "onsite", href: u.href, host: u.host, scheme: u.protocol };
  }
  return { kind: "offsite", href: u.href, host: u.host, scheme: u.protocol };
}

// True if the string contains any ASCII control character (browsers/parsers
// strip several of these, which is a classic way to smuggle a bypass).
function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20 || s.charCodeAt(i) === 0x7f) return true;
  }
  return false;
}

// VULNERABLE: redirect to whatever was supplied.
function redirectVulnerable(value) {
  return resolveTarget(value); // we "send" the browser wherever this lands
}

// PATCHED: only allow a *local* path — must start with a single "/" and not be
// the protocol-relative "//" or a backslash variant, and must carry no scheme.
// Anything else falls back to a known-safe in-app page.
function isSafeLocalPath(value) {
  const v = String(value);
  // Reject if a URL parser would read a scheme or an authority out of it.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v.trim())) return false; // has a scheme
  // Must begin with "/", but NOT "//" or "/\" (both become protocol-relative).
  if (!/^\/[^/\\]/.test(v)) return false;
  // Backslashes anywhere are suspicious (browsers treat "\" like "/").
  if (v.includes("\\")) return false;
  // Whitespace or control chars can smuggle bypasses past naive checks.
  if (/\s/.test(v) || hasControlChar(v)) return false;
  return true;
}

function redirectPatched(value) {
  if (isSafeLocalPath(value)) {
    const u = new URL(value, APP_ORIGIN);
    return { allowed: true, target: resolveTarget(value), normalized: u.pathname + u.search + u.hash };
  }
  return { allowed: false, target: resolveTarget(value), fallback: SAFE_FALLBACK };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "open-redirect",
  title: "Open Redirect",
  severity: "Low",
  category: "Unvalidated redirect / phishing",
  cwe: "CWE-601",
  summary:
    "Reflecting a user-supplied URL into a redirect lets an attacker send victims off-site under cover of your trusted domain — a clean phishing and token-leak primitive.",

  explanation: `
    <p>Lots of flows take a "where to go next" URL from the request — login
    (<code>?next=</code>), logout, OAuth (<code>redirect_uri</code>), "continue to
    checkout". If the app redirects to that value <strong>without checking it stays
    on your site</strong>, anyone can craft a link that <em>starts</em> at your
    trusted domain and <em>ends</em> on theirs.</p>
    <p>Why it matters even though "it's just a redirect":</p>
    <ul>
      <li><strong>Phishing</strong> — the visible link is
        <code>https://trusted.app/login?next=…</code>; victims trust it, then land
        on a pixel-perfect fake login on the attacker's host.</li>
      <li><strong>Token theft</strong> — chained with OAuth/SSO, an open
        <code>redirect_uri</code> can leak auth codes or tokens to the attacker.</li>
      <li><strong>XSS</strong> — if the value is fed to a client-side redirect, a
        <code>javascript:</code> URL can execute in your origin.</li>
    </ul>
    <p>The gotchas are all in URL parsing: <code>//evil.com</code> is
    protocol-relative, <code>/\\evil.com</code> normalizes to the same thing,
    <code>https://trusted.app@evil.com</code> actually targets
    <code>evil.com</code>, and <code>https://trusted.app.evil.com</code> is a
    different host entirely. Substring checks like
    <code>url.includes("trusted.app")</code> fail all of these.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — redirect to whatever was supplied",
    code: `app.get("/login", (req, res) => {
  // ... authenticate the user ...
  // the bug: bounce them to the raw ?next= value
  res.redirect(req.query.next || "/dashboard");
});

// And the "clever" but still-broken substring check:
function looksLocal(next) {
  return next.includes("trusted.app");   // matches the wrong things
}
// https://trusted.app.evil.com  and  https://evil.com/?x=trusted.app
// both pass, and //evil.com doesn't even contain it but still redirects off-site.`,
  },

  fixExplanation: `
    <p>Don't try to spot "bad" URLs — only allow provably <strong>local</strong>
    ones:</p>
    <ul>
      <li><strong>Allow relative paths only.</strong> Require the value to start
        with a single <code>/</code> that is <em>not</em> <code>//</code> or
        <code>/\\</code>, contains no scheme, and has no backslashes or control
        characters. Reject everything else to a safe in-app default.</li>
      <li><strong>Or use an explicit allow-list</strong> of full destination URLs
        / hosts when you genuinely need to redirect off-site (e.g. known OAuth
        clients). Match the <em>parsed host</em>, never a substring.</li>
      <li><strong>Resolve and re-check.</strong> Parse with the WHATWG URL API and
        compare <code>url.origin</code> to your own — don't hand-roll string
        checks.</li>
    </ul>
    <p>For OAuth specifically, register exact <code>redirect_uri</code> values and
    compare them whole.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — local paths only, else safe fallback",
    code: `const APP_ORIGIN = "https://trusted.app";
const SAFE_FALLBACK = "/dashboard";

function safeNext(next) {
  if (typeof next !== "string") return SAFE_FALLBACK;
  // must be a local path: one leading slash, no scheme, no "//" or backslash
  if (!/^\\/[^/\\\\]/.test(next)) return SAFE_FALLBACK;
  if (next.includes("\\\\") || /\\s/.test(next)) return SAFE_FALLBACK;
  if ([...next].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return SAFE_FALLBACK; // reject control chars
  // resolve and confirm it really stays on our origin
  const u = new URL(next, APP_ORIGIN);
  return u.origin === APP_ORIGIN ? u.pathname + u.search + u.hash : SAFE_FALLBACK;
}

app.get("/login", (req, res) => {
  // ... authenticate ...
  res.redirect(safeNext(req.query.next));
});`,
  },

  sandbox: {
    intro: `
      <p>This models <code>GET /login?next=…</code> on
      <code>${APP_ORIGIN}</code>: after login the app redirects to your
      <code>next</code> value. In <em>Vulnerable</em> mode it redirects wherever
      that resolves — try the bypass presets and watch the victim land off-site or
      hit a <code>javascript:</code> URL. Flip to <em>Patched</em> and only a real
      local path is honored; everything else falls back to
      <code>${SAFE_FALLBACK}</code>.</p>
    `,
    inputLabel: "next = (the post-login redirect target)",
    placeholder: "e.g. /account/settings",
    default: "/account/settings",
    presets: [
      { label: "/account/settings (legit)", value: "/account/settings" },
      { label: "//evil.example (protocol-relative)", value: "//evil.example/login" },
      { label: "/\\evil.example (backslash)", value: "/\\evil.example/login" },
      { label: "https://evil.example (absolute)", value: "https://evil.example/login" },
      { label: "tab-smuggled //evil (control char)", value: "\t//evil.example/login" },
      { label: "userinfo @evil trick", value: "https://trusted.app@evil.example/login" },
      { label: "suffix trick", value: "https://trusted.app.evil.example/login" },
      { label: "javascript: URL", value: "javascript:alert(document.domain)" },
    ],

    run(input, { patched }) {
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }
      const value = input;

      if (!value.trim()) {
        return {
          verdict: "safe",
          steps: [{ label: "next", value: "(empty)" }],
          note: "No redirect target supplied — the app would use its default landing page.",
        };
      }

      const t = resolveTarget(value);

      if (patched) {
        const r = redirectPatched(value);
        const steps = [
          { label: "next", value },
          { label: "Is it a safe local path?", value: r.allowed ? "yes" : "no", flag: "good" },
        ];
        if (r.allowed) {
          steps.push({ label: "Redirect to", value: `${APP_ORIGIN}${r.normalized}`, flag: "good" });
          return {
            verdict: "safe",
            steps,
            note: "A genuine in-app path — redirect allowed, and it provably stays on our origin.",
          };
        }
        steps.push({
          label: "Where it WOULD have gone",
          value: t.kind === "dangerous" ? `${t.href}  (dangerous scheme)` : t.href,
          flag: "good",
        });
        steps.push({ label: "Redirect to", value: `${APP_ORIGIN}${SAFE_FALLBACK}  (safe fallback)`, flag: "good" });
        return {
          verdict: "blocked",
          steps,
          note:
            "Rejected. The validator allows only local paths (one leading slash, no scheme, no " +
            "\"//\" or backslash), so every off-site and javascript: trick falls back to a known-safe " +
            "in-app page. Substring checks would have let several of these through.",
        };
      }

      // Vulnerable path.
      const steps = [{ label: "next", value }];
      if (t.kind === "onsite") {
        steps.push({ label: "Resolves to", value: t.href, flag: "good" });
        steps.push({ label: "Redirect issued", value: t.href });
        return {
          verdict: "safe",
          steps,
          note: "This value happens to stay on-site, so it's harmless here — but the handler does no validation, so any of the off-site presets would redirect away just the same.",
        };
      }
      if (t.kind === "dangerous") {
        steps.push({ label: "Scheme", value: `${t.scheme} — not a navigation; executes in the page`, flag: "bad" });
        steps.push({ label: "Result", value: `browser runs: ${t.href}`, flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note:
            "A javascript:/data: URL reflected into a redirect runs script in YOUR origin — an open " +
            "redirect that escalates straight to XSS. Cookies, tokens, and the DOM are all reachable.",
        };
      }
      if (t.kind === "invalid") {
        steps.push({ label: "Result", value: "value didn't parse — no redirect" });
        return { verdict: "safe", steps, note: "This particular string didn't resolve to a target, but the endpoint trusts any value, so a well-formed off-site URL still works." };
      }
      // offsite
      steps.push({ label: "Resolves to host", value: t.host, flag: "bad" });
      steps.push({ label: "Redirect issued", value: `${t.href}  (OFF-SITE)`, flag: "bad" });
      return {
        verdict: "exploited",
        steps,
        note:
          "Open redirect: the link starts on " + APP_ORIGIN + " — which the victim trusts — and ends " +
          "on " + t.host + ". Perfect for phishing (drop a fake login there) or for leaking OAuth " +
          "tokens passed through the redirect.",
      };
    },
  },

  references: [
    { label: "OWASP — Unvalidated Redirects and Forwards Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html" },
    { label: "PortSwigger — DOM-based open redirection", url: "https://portswigger.net/web-security/dom-based/open-redirection" },
    { label: "CWE-601 — URL Redirection to Untrusted Site", url: "https://cwe.mitre.org/data/definitions/601.html" },
  ],
};
