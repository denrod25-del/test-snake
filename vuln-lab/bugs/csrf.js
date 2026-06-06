/**
 * Bug module: Cross-Site Request Forgery (CSRF)
 *
 * Self-contained. The sandbox simulates a logged-in victim's browser hitting a
 * bank "transfer money" endpoint. The victim's session cookie is attached
 * AUTOMATICALLY by the browser on every request to the bank — including requests
 * triggered by a malicious page on another origin. That ambient authority is the
 * whole bug: the attacker doesn't need to steal the cookie, they just need to
 * make the victim's browser send a request.
 *
 * The defense modelled here is the synchronizer-token pattern: the server plants
 * a secret, per-session CSRF token in its OWN pages and requires it back on every
 * state-changing request. A cross-site attacker can make the browser send the
 * cookie, but the same-origin policy stops their page from READING the bank's
 * pages, so they can't learn the token — and the request is rejected. (Origin /
 * SameSite=Strict are shown as defense-in-depth in the fix.)
 */

// ---- Mock bank --------------------------------------------------------------

// The secret token the bank embeds in its own transfer form for this session.
// A same-origin page can read it from the DOM; a cross-origin attacker cannot.
const SESSION_CSRF_TOKEN = "9f3a1c7e2b5d40";

const BANK_ORIGIN = "https://bank.example";
const ATTACKER_ORIGIN = "https://totally-free-prizes.example";

// A request "is forged" when it didn't carry the real token — because only a
// page served by the bank itself could have read that token to include it.
function isForged(submittedToken) {
  return submittedToken !== SESSION_CSRF_TOKEN;
}

// VULNERABLE: act on the request purely because the session cookie is valid.
// The token (if any) is never checked.
function handleTransferVulnerable(submittedToken) {
  return {
    executed: true, // always — the cookie alone authorizes it
    forged: isForged(submittedToken),
  };
}

// PATCHED: require a CSRF token that matches the session, compared in
// constant time. No valid token -> reject before doing anything.
function constantTimeEquals(a, b) {
  // Length leak is acceptable here; the point is not to early-exit on the first
  // differing byte. Modelled simply for the sandbox.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function handleTransferPatched(submittedToken) {
  const ok = constantTimeEquals(submittedToken, SESSION_CSRF_TOKEN);
  return { executed: ok, forged: isForged(submittedToken) };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "csrf",
  title: "Cross-Site Request Forgery (CSRF)",
  severity: "Medium",
  category: "Request forgery / session abuse",
  cwe: "CWE-352",
  summary:
    "A malicious page makes the victim's browser send an authenticated state-changing request to a site they're logged into — the session cookie rides along automatically.",

  explanation: `
    <p>CSRF abuses <strong>ambient authority</strong>. When you're logged into a
    site, your browser attaches that site's session cookie to <em>every</em>
    request to it — including requests kicked off by a <em>different</em> site you
    happen to be visiting. So an attacker's page can quietly make your browser
    POST to your bank, and the bank sees a perfectly authenticated request.</p>
    <p>The attacker never sees or steals your cookie. They just need an
    auto-submitting form (or an <code>&lt;img&gt;</code>/<code>fetch</code>)
    pointed at a <strong>state-changing endpoint</strong> — transfer money, change
    email, add an admin. If that endpoint authorizes the action on the strength of
    the cookie <em>alone</em>, the forged request goes through.</p>
    <p>The key insight behind the fix: the attacker's page can make your browser
    <em>send</em> a request, but the <strong>same-origin policy</strong> stops it
    from <em>reading</em> the bank's pages. So if the bank requires a secret value
    that only its own pages contain, the attacker can't supply it.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — the cookie alone authorizes the action",
    code: `// Server: a state-changing endpoint with no anti-CSRF check.
app.post("/transfer", requireLogin, (req, res) => {
  // ❌ session cookie is valid -> just do it. No proof the request
  //    actually came from one of OUR pages.
  bank.transfer(req.session.userId, req.body.to, req.body.amount);
  res.send("ok");
});

/* Attacker hosts this on evil.com. Just visiting it fires the POST
   with the victim's bank cookie attached automatically: */
// <form action="https://bank.example/transfer" method="POST">
//   <input name="to" value="attacker"><input name="amount" value="5000">
// </form>
// <script>document.forms[0].submit()</script>`,
  },

  fixExplanation: `
    <p>Require proof that the request originated from your own pages:</p>
    <ul>
      <li><strong>Synchronizer token (CSRF token)</strong> — embed a secret,
        per-session, unpredictable token in your forms/pages and require it back
        on every state-changing request. A cross-site attacker can't read your
        pages (same-origin policy), so they can't learn the token. Compare it in
        constant time.</li>
      <li><strong><code>SameSite</code> cookies</strong> — set the session cookie
        <code>SameSite=Lax</code> (or <code>Strict</code>) so the browser won't
        attach it to cross-site POSTs in the first place. Great defense in depth,
        but don't rely on it alone (older clients, some navigation cases).</li>
      <li><strong>Verify <code>Origin</code>/<code>Referer</code></strong> on
        state-changing requests and reject foreign origins.</li>
    </ul>
    <p>Also: use safe HTTP methods correctly — <code>GET</code> must never change
    state — and require re-authentication for the most sensitive actions.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — synchronizer token + SameSite",
    code: `// Cookie set at login so the browser won't even send it cross-site:
//   Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax

const crypto = require("crypto");

app.post("/transfer", requireLogin, (req, res) => {
  const expected = req.session.csrfToken;          // planted in our own form
  const got = req.body.csrf_token || "";
  const a = Buffer.from(got), b = Buffer.from(expected);

  // ✓ constant-time compare; reject anything that didn't come from our page
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).send("bad or missing CSRF token");
  }
  // (defense in depth) also check the Origin header matches our site
  if (req.get("Origin") && new URL(req.get("Origin")).host !== req.get("Host")) {
    return res.status(403).send("cross-origin request refused");
  }

  bank.transfer(req.session.userId, req.body.to, req.body.amount);
  res.send("ok");
});`,
  },

  sandbox: {
    intro: `
      <p>You're logged into <code>bank.example</code> in another tab. This models
      a <code>POST /transfer?to=attacker&amount=5000</code> hitting the bank — the
      session cookie is attached <em>automatically</em>. The only thing you control
      is the <code>csrf_token</code> field the request carries. A forged request
      from another site can't read the bank's pages, so it can't supply the real
      token (it's <code>${SESSION_CSRF_TOKEN}</code> this session). In
      <em>Vulnerable</em> mode the token is ignored and the transfer always fires;
      flip to <em>Patched</em> and only a request carrying the real token is
      honored.</p>
    `,
    inputLabel: "csrf_token sent with the forged transfer request",
    placeholder: "(forged requests usually send nothing here)",
    default: "",
    presets: [
      { label: "Forged from evil.com (no token)", value: "" },
      { label: "Forged + guessed token", value: "guess-12345" },
      { label: "Legit (bank's own form supplies token)", value: SESSION_CSRF_TOKEN },
    ],

    run(input, { patched }) {
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }
      const submitted = input.trim();
      const forged = isForged(submitted);
      const origin = forged ? ATTACKER_ORIGIN : BANK_ORIGIN;

      // Steps shared by both modes: the request and its ambient authority.
      const baseSteps = [
        { label: "Request", value: `POST ${BANK_ORIGIN}/transfer  (to=attacker, amount=5000)` },
        { label: "Triggered by page on", value: origin, flag: forged ? "bad" : "good" },
        {
          label: "Session cookie attached automatically?",
          value: "yes — the browser always sends it to bank.example",
          flag: "bad",
        },
        { label: "csrf_token field", value: submitted ? submitted : "(none sent)" },
      ];

      if (patched) {
        const r = handleTransferPatched(submitted);
        baseSteps.push({
          label: "Token matches this session?",
          value: r.executed ? "yes" : "no — missing or wrong",
          flag: r.executed ? "good" : "good", // both are "good" outcomes for the defender
        });
        if (!r.executed) {
          baseSteps.push({ label: "Server decision", value: "403 — bad or missing CSRF token", flag: "good" });
          return {
            verdict: "blocked",
            steps: baseSteps,
            note:
              "Refused. The browser still attached the cookie, but the bank demanded a secret token " +
              "that only its own pages contain. A cross-site attacker can't read those pages " +
              "(same-origin policy), so they can't produce the token — and SameSite=Lax means the " +
              "cookie usually wouldn't even be sent cross-site.",
          };
        }
        baseSteps.push({ label: "Server decision", value: "transfer executed — request proven same-origin", flag: "good" });
        return {
          verdict: "safe",
          steps: baseSteps,
          note: "This request carried the real token, so it genuinely came from the bank's own form — the intended use. Forged requests are rejected before this point.",
        };
      }

      // Vulnerable path: token is never checked.
      const r = handleTransferVulnerable(submitted);
      baseSteps.push({ label: "Does the server check the token?", value: "no — the valid cookie is treated as enough", flag: "bad" });
      baseSteps.push({
        label: "Result",
        value: "✗ transfer executed: $5000 sent to attacker",
        flag: "bad",
      });
      if (r.forged) {
        return {
          verdict: "exploited",
          steps: baseSteps,
          note:
            "CSRF succeeded. A page the victim merely visited caused an authenticated transfer — " +
            "the attacker never touched the cookie, they just borrowed the browser's ambient authority. " +
            "Any state-changing endpoint that trusts the cookie alone is vulnerable.",
        };
      }
      return {
        verdict: "safe",
        steps: baseSteps,
        note: "This particular request happens to be legitimate (it carried the real token), so it's the intended action — but the handler would equally execute a forged one, which is the bug.",
      };
    },
  },

  references: [
    { label: "OWASP — Cross-Site Request Forgery (CSRF)", url: "https://owasp.org/www-community/attacks/csrf" },
    { label: "OWASP — CSRF Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html" },
    { label: "PortSwigger — CSRF", url: "https://portswigger.net/web-security/csrf" },
    { label: "MDN — SameSite cookies", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite" },
    { label: "CWE-352 — Cross-Site Request Forgery", url: "https://cwe.mitre.org/data/definitions/352.html" },
  ],
};
