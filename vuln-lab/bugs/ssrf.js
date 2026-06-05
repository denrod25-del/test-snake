/**
 * Bug module: Server-Side Request Forgery (SSRF)
 *
 * Self-contained. The sandbox simulates a "URL preview / fetch" endpoint: the
 * server fetches a user-supplied URL and returns the response. A mock network
 * (DNS resolver + IPv4 range classifier + a few internal "servers", below)
 * makes the request resolve against simulated infrastructure — including the
 * cloud metadata service at 169.254.169.254 — so pointing the fetcher at
 * internal targets genuinely returns internal data. The PATCHED fetcher
 * allow-lists the scheme and validates the RESOLVED IP (not the hostname), which
 * is what blocks the DNS-rebinding case where a public-looking name resolves to
 * an internal address.
 */

// ---- Mock infrastructure ----------------------------------------------------

// Files reachable via the file:// scheme.
const FILES = {
  "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "/etc/shadow": "root:$6$rounds=656000$abc...:19000:0:99999:7:::",
};

// The crown jewel: cloud instance metadata (AWS IMDS-style) temporary creds.
const IMDS_CREDENTIALS = JSON.stringify(
  {
    Code: "Success",
    Type: "AWS-HMAC",
    AccessKeyId: "ASIAIOSFODNN7EXAMPLE",
    SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    Token: "IQoJb3JpZ2luX2VjEND...snt_long_session_token...==",
    Expiration: "2026-06-05T21:00:00Z",
  },
  null,
  2
);

// DNS: hostname -> IPv4. Note evil.attacker.com resolves to the metadata IP —
// a public-looking name that points inside (the DNS-rebinding/SSRF bypass).
const DNS = {
  "example.com": "93.184.216.34",
  "api.example.com": "93.184.216.34",
  "localhost": "127.0.0.1",
  "metadata.google.internal": "169.254.169.254",
  "internal-admin.corp": "10.0.0.5",
  "evil.attacker.com": "169.254.169.254",
};

function resolveHost(host) {
  if (host in DNS) return DNS[host];
  if (host === "localhost") return "127.0.0.1";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host; // IPv4 literal
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return "::1";
  return null; // unknown / unresolvable
}

// Classify an IP into a trust zone. This is the load-bearing defensive check.
function classifyIp(ip) {
  if (ip === "::1") return "loopback";
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return "public";
  const a = +m[1], b = +m[2];
  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 169 && b === 254) return "link-local"; // includes 169.254.169.254 metadata
  if (a === 0) return "reserved";
  return "public";
}

// What a given internal/external server returns for this request.
function serverResponse(scheme, ip, port, path) {
  if (scheme === "file") {
    return FILES[path] ?? `curl: (37) Couldn't read file ${path}`;
  }
  if (ip === "169.254.169.254") {
    if (/iam\/security-credentials\/\S+/.test(path)) return IMDS_CREDENTIALS;
    if (/iam\/security-credentials\/?$/.test(path)) return "web-app-role";
    return "ami-id\nhostname\niam/\ninstance-id\nlocal-ipv4\n(EC2 instance metadata index)";
  }
  const cls = classifyIp(ip);
  if (cls === "loopback" || cls === "private") {
    if (port === "6379") return "# Redis 7.0 (internal cache, no auth)\nredis_version:7.0.11\nrole:master";
    if (port === "8080" || /admin/i.test(path)) return "<h1>Internal Admin Panel</h1>\nUsers, secrets, and deploy controls — trusts requests from the internal network, no auth.";
    return `(connected to internal service at ${ip}:${port || "80"})`;
  }
  return "<!doctype html>\n<title>Example Domain</title>\n<body>Example Domain — a normal public website.</body>";
}

// ---- URL parsing ------------------------------------------------------------

function parseUrl(input) {
  let raw = input.trim();
  if (!raw.includes("://")) raw = "http://" + raw; // forgive "localhost:6379"
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  return {
    scheme: u.protocol.replace(/:$/, ""),
    host: u.hostname.replace(/^\[|\]$/g, ""), // strip IPv6 brackets
    port: u.port,
    path: (u.pathname || "/") + (u.search || ""),
  };
}

// ---- The two fetch implementations -----------------------------------------

const ALLOWED_SCHEMES = new Set(["http", "https"]);

// VULNERABLE: fetch whatever the user asked for, from the server.
function fetchVulnerable(input) {
  const u = parseUrl(input);
  if (!u) return { error: "invalid URL" };
  if (u.scheme === "file") {
    return { u, ip: null, zone: "file", internal: true, body: serverResponse("file", null, null, u.path) };
  }
  if (!ALLOWED_SCHEMES.has(u.scheme)) {
    // gopher://, dict://, etc. — exotic schemes are a classic SSRF amplifier
    return { u, ip: null, zone: "scheme", internal: true, body: `(spoke ${u.scheme}:// to ${u.host} — protocol smuggling)` };
  }
  const ip = resolveHost(u.host);
  if (!ip) return { u, ip: null, zone: "unresolved", internal: false, error: "could not resolve host" };
  const zone = classifyIp(ip);
  const internal = zone !== "public";
  return { u, ip, zone, internal, body: serverResponse(u.scheme, ip, u.port, u.path) };
}

// PATCHED: allow-list the scheme, resolve the host, validate the RESOLVED IP.
function fetchPatched(input) {
  const u = parseUrl(input);
  if (!u) return { blocked: true, reason: "invalid URL" };
  if (!ALLOWED_SCHEMES.has(u.scheme)) {
    return { u, blocked: true, reason: `scheme "${u.scheme}:" not allowed (only http/https)` };
  }
  const ip = resolveHost(u.host);
  if (!ip) return { u, blocked: true, reason: "could not resolve host" };
  const zone = classifyIp(ip);
  if (zone !== "public") {
    return { u, ip, zone, blocked: true, reason: `resolved IP ${ip} is in a blocked range (${zone})` };
  }
  return { u, ip, zone, blocked: false, body: serverResponse(u.scheme, ip, u.port, u.path) };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "ssrf",
  title: "Server-Side Request Forgery (SSRF)",
  severity: "High",
  category: "Broken access / request forgery",
  cwe: "CWE-918",
  summary:
    "Making the server fetch a user-supplied URL lets an attacker reach internal-only systems — cloud metadata, admin panels, databases — from inside the trust boundary.",

  explanation: `
    <p>SSRF happens when an application takes a <strong>URL from the user and
    fetches it itself</strong> — for a link preview, webhook, image proxy, PDF
    render, or "import from URL". The request now comes <em>from the server</em>,
    using the server's network position and identity, so the attacker borrows
    that access to reach things they never could directly.</p>
    <p>The classic target is the <strong>cloud metadata service</strong> at
    <code>169.254.169.254</code> — fetching it returns the instance's temporary
    IAM credentials, which is a fast path to owning the whole cloud account.
    Other targets: <code>localhost</code> services with no auth (Redis,
    Elasticsearch, admin panels), other hosts on the private network
    (<code>10.x</code>, <code>192.168.x</code>), and non-HTTP schemes like
    <code>file://</code> (read local files) or <code>gopher://</code> (smuggle
    raw protocol bytes).</p>
    <p>The subtle part: blocking by <em>hostname</em> isn't enough. An attacker
    controls DNS, so a perfectly innocent-looking name can resolve to
    <code>169.254.169.254</code>. The check has to be on the <em>resolved IP</em>,
    right before connecting.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — fetch the user's URL as-is",
    code: `app.get("/fetch", async (req, res) => {
  // ❌ the server fetches whatever URL the user supplies
  const response = await fetch(req.query.url);
  res.send(await response.text());           // and hands back the body
});
// url = http://169.254.169.254/latest/meta-data/iam/security-credentials/role
//   -> returns the instance's cloud credentials`,
  },

  fixExplanation: `
    <p>Validate the <strong>destination</strong>, not the string. Three layers:</p>
    <ul>
      <li><strong>Allow-list the scheme</strong> — only <code>http</code>/<code>https</code>
        (kills <code>file://</code>, <code>gopher://</code>, <code>dict://</code>).</li>
      <li><strong>Resolve the host and check the IP</strong> against a denylist of
        loopback / private / link-local / reserved ranges
        (<code>127/8</code>, <code>10/8</code>, <code>172.16/12</code>,
        <code>192.168/16</code>, <code>169.254/16</code>, …) before connecting —
        and <strong>pin the connection to that validated IP</strong> so DNS can't
        be re-pointed between the check and the request (rebinding / TOCTOU).</li>
      <li><strong>Don't follow redirects blindly</strong> — re-validate every hop,
        and prefer an <em>allow-list</em> of known-good destinations.</li>
    </ul>
    <p>Defense in depth: network egress controls, require IMDSv2 (or block
    <code>169.254.169.254</code> at the host), and don't echo raw responses back.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — validate scheme + resolved IP",
    code: `const dns = require("dns").promises;
const ALLOWED = new Set(["http:", "https:"]);

function isBlockedIp(ip) {            // loopback / private / link-local / reserved
  return /^(127\\.|10\\.|169\\.254\\.|0\\.)/.test(ip)
      || /^172\\.(1[6-9]|2\\d|3[01])\\./.test(ip)
      || /^192\\.168\\./.test(ip)
      || ip === "::1";
}

app.get("/fetch", async (req, res) => {
  let url;
  try { url = new URL(req.query.url); } catch { return res.status(400).send("bad url"); }
  if (!ALLOWED.has(url.protocol)) return res.status(400).send("scheme not allowed");

  const { address } = await dns.lookup(url.hostname);   // resolve, then judge the IP
  if (isBlockedIp(address)) return res.status(400).send("blocked: internal address");

  // pin the socket to \`address\` and don't follow redirects blindly
  const r = await fetch(url, { redirect: "error" });
  res.send(await r.text());
});`,
  },

  sandbox: {
    intro: `
      <p>This simulates a <code>/fetch?url=…</code> link-preview endpoint. In
      <em>Vulnerable</em> mode the server fetches whatever URL you give it; point
      it at an internal address and watch it pull back data it should never reach.
      Flip to <em>Patched</em> and the same URL is checked by scheme <em>and</em>
      resolved IP. Note the <code>evil.attacker.com</code> preset: a public-looking
      hostname that resolves to the metadata IP — only the IP check stops it.</p>
    `,
    inputLabel: "URL to fetch (the ?url= value)",
    placeholder: "e.g. https://example.com",
    default: "https://example.com",
    presets: [
      { label: "https://example.com (legit)", value: "https://example.com" },
      { label: "cloud metadata creds", value: "http://169.254.169.254/latest/meta-data/iam/security-credentials/web-role" },
      { label: "internal Redis", value: "http://localhost:6379/" },
      { label: "internal admin (10.0.0.5)", value: "http://10.0.0.5/admin" },
      { label: "file:// local read", value: "file:///etc/passwd" },
      { label: "DNS rebind → metadata", value: "http://evil.attacker.com/latest/meta-data/iam/security-credentials/web-role" },
    ],

    run(input, { patched }) {
      input = typeof input === "string" ? input : String(input);

      // Empty input fetches nothing — keep both modes consistent.
      if (!input.trim()) {
        return {
          verdict: "safe",
          steps: [{ label: "Requested URL", value: "(empty)" }],
          note: "Nothing entered — no request is made.",
        };
      }

      if (patched) {
        const r = fetchPatched(input);
        const steps = [{ label: "Requested URL", value: input || "(empty)" }];
        if (r.u) {
          steps.push({ label: "Scheme allow-listed (http/https)?", value: ALLOWED_SCHEMES.has(r.u.scheme) ? "yes" : `no — "${r.u.scheme}:"`, flag: "good" });
          if (r.ip) {
            steps.push({ label: "DNS resolves host to", value: `${r.u.host} → ${r.ip} (${r.zone})`, flag: "good" });
          }
        }
        if (r.blocked) {
          steps.push({ label: "Egress decision", value: `BLOCKED — ${r.reason}`, flag: "good" });
          return {
            verdict: "blocked",
            steps,
            note:
              "Refused before any request left the server. The fix validates the resolved " +
              "IP, so even a public-looking hostname that points at an internal address " +
              "(the rebind case) is caught — and non-HTTP schemes never get a chance.",
          };
        }
        steps.push({ label: "IP in blocked range?", value: "no — public address, request allowed", flag: "good" });
        steps.push({ label: "Response body", value: r.body, flag: "good" });
        return {
          verdict: "safe",
          steps,
          note: "A genuinely public destination passed both checks and was fetched — the intended use, with internal targets walled off.",
        };
      }

      // Vulnerable path
      const r = fetchVulnerable(input);
      if (r.error && !r.u) {
        return {
          verdict: "safe",
          steps: [
            { label: "Requested URL", value: input || "(empty)" },
            { label: "Result", value: r.error },
          ],
          note: "The URL didn't parse, so nothing was fetched — but any valid internal URL would be.",
        };
      }

      const steps = [
        { label: "Requested URL", value: input },
        { label: "Parsed", value: `scheme=${r.u.scheme}  host=${r.u.host}  port=${r.u.port || "(default)"}  path=${r.u.path}` },
      ];
      if (r.zone === "file") {
        steps.push({ label: "Scheme", value: "file:// — reads from the server's local disk", flag: "bad" });
      } else if (r.zone === "scheme") {
        steps.push({ label: "Scheme", value: `${r.u.scheme}:// — non-HTTP protocol to an internal target`, flag: "bad" });
      } else if (r.error) {
        steps.push({ label: "DNS", value: `${r.u.host} → ${r.error}` });
      } else {
        steps.push({ label: "DNS resolves host to", value: `${r.u.host} → ${r.ip}`, flag: r.internal ? "bad" : "good" });
        steps.push({ label: "Target zone", value: r.zone + (r.ip === "169.254.169.254" ? " — CLOUD METADATA SERVICE" : ""), flag: r.internal ? "bad" : "good" });
      }
      if (r.body) {
        steps.push({ label: "Response the server fetched", value: r.body, flag: r.internal ? "bad" : "good" });
      }

      if (r.error) {
        return { verdict: "safe", steps, note: "Host didn't resolve, so nothing came back this time — but the fetcher trusts any URL, so a resolvable internal target succeeds." };
      }
      return {
        verdict: r.internal ? "exploited" : "safe",
        steps,
        note: r.internal
          ? "SSRF succeeded: the server made the request from inside the trust boundary and " +
            "handed back data from a resource the attacker could never reach directly — here, " +
            (r.ip === "169.254.169.254" ? "live cloud credentials that own the account." : "an internal-only service / file.")
          : "A normal public URL — fetched as intended. But the fetcher does no validation, so it's one internal URL away from the attacks above.",
      };
    },
  },

  references: [
    { label: "OWASP — Server Side Request Forgery", url: "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery" },
    { label: "OWASP — SSRF Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html" },
    { label: "PortSwigger — SSRF", url: "https://portswigger.net/web-security/ssrf" },
    { label: "CWE-918 — Server-Side Request Forgery", url: "https://cwe.mitre.org/data/definitions/918.html" },
  ],
};
