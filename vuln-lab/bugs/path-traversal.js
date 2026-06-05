/**
 * Bug module: Path Traversal / Zip Slip
 *
 * Self-contained. The sandbox simulates a server that serves files out of an
 * upload directory (and, equivalently, a zip extractor writing entries into a
 * target directory). The "filesystem" and the path resolver below are pure
 * JS running in your browser — no real files are touched.
 */

// ---- Simulated server state -------------------------------------------------

const BASE = "/srv/app/uploads";

// A fake filesystem. Files under BASE are meant to be public; everything else
// is off-limits and represents what an attacker is trying to reach.
const FS = {
  "/srv/app/uploads/avatar.png": "‹binary PNG image data — a user avatar›",
  "/srv/app/uploads/report-2026.pdf": "‹binary PDF data — a quarterly report›",
  "/srv/app/.env": "DB_HOST=prod-db.internal\nDB_USER=admin\nDB_PASSWORD=hunter2\nSTRIPE_KEY=sk_live_51Hxxxxxxxxxxxx",
  "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "/home/app/.ssh/id_rsa": "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA…(snip)…\n-----END OPENSSH PRIVATE KEY-----",
};

// ---- A tiny POSIX path resolver (mirrors Node's path.join + normalize) ------

function normalizePosix(p) {
  const isAbsolute = p.startsWith("/");
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!isAbsolute) out.push("..");
      // at an absolute root, ".." is a no-op — exactly like a real filesystem
    } else {
      out.push(seg);
    }
  }
  return (isAbsolute ? "/" : "") + out.join("/");
}

// What `path.join(base, userInput)` effectively does: concatenate, then
// collapse "." and ".." segments.
function joinPosix(base, input) {
  return normalizePosix(base + "/" + input);
}

function isInside(base, resolved) {
  return resolved === base || resolved.startsWith(base + "/");
}

// ---- The two implementations the sandbox runs against -----------------------

// VULNERABLE: trusts the user-supplied name and reads whatever it resolves to.
function serveFileVulnerable(input) {
  const resolved = joinPosix(BASE, input);
  const escaped = !isInside(BASE, resolved);
  const exists = resolved in FS;
  return { resolved, escaped, exists, blocked: false };
}

// PATCHED: resolve first, then verify the result is still inside BASE.
function serveFilePatched(input) {
  const resolved = joinPosix(BASE, input);
  const escaped = !isInside(BASE, resolved);
  if (escaped) return { resolved, escaped, exists: false, blocked: true };
  const exists = resolved in FS;
  return { resolved, escaped, exists, blocked: false };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "path-traversal",
  title: "Path Traversal / Zip Slip",
  severity: "High",
  category: "Improper file path handling",
  cwe: "CWE-22 / CWE-23",
  summary:
    "Untrusted input used to build a file path lets an attacker escape the intended directory and read or write arbitrary files.",

  explanation: `
    <p>A path traversal bug happens when an application builds a filesystem path
    by gluing a <strong>fixed base directory</strong> onto a
    <strong>user-controlled filename</strong> — and then trusts the result.</p>
    <p>The trouble is that <code>..</code> means "go up one directory". If the
    user supplies a name like <code>../../../../etc/passwd</code>, the
    <code>..</code> segments walk back out of the intended folder. After the
    operating system resolves the path, you're no longer inside the upload
    directory at all — you're reading <code>/etc/passwd</code>, an SSH key, or a
    secrets file.</p>
    <p><strong>Zip Slip</strong> is the same bug wearing a different hat. When a
    program extracts an archive, it writes each entry to
    <code>join(targetDir, entry.name)</code>. A malicious archive can contain an
    entry literally named <code>../../../../etc/cron.d/evil</code>, so extracting
    it <em>writes</em> a file outside the target directory — potentially
    overwriting a config or planting a script that later runs.</p>
    <p>The root cause in both cases: the path is resolved <em>after</em> the
    decision to trust it, instead of <em>before</em>.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — server route (Node/Express)",
    code: `const BASE = "/srv/app/uploads";

app.get("/download", (req, res) => {
  // ❌ user-controlled name is joined straight onto the base path
  const filePath = path.join(BASE, req.query.name);
  // path.join collapses "../" segments, so the result can escape BASE
  res.sendFile(filePath);            // serves whatever it resolved to
});

// Zip Slip — same mistake during extraction:
for (const entry of zip.entries) {
  const dest = path.join(targetDir, entry.name);  // ❌ entry.name is attacker data
  fs.writeFileSync(dest, entry.data);              // can write outside targetDir
}`,
  },

  fixExplanation: `
    <p>The fix is to <strong>resolve the full path first, then verify it still
    lives inside the base directory</strong> before touching the filesystem.
    Resolving collapses every <code>..</code>; the containment check
    (<code>resolved === base || resolved.startsWith(base + "/")</code>) then
    catches anything that escaped. Reject — don't sanitize by string-replacing
    <code>..</code>, which is easy to bypass (e.g. <code>....//</code>, URL- or
    double-encoding).</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — resolve, then contain",
    code: `const path = require("path");
const BASE = path.resolve("/srv/app/uploads");

function safeJoin(base, userInput) {
  const resolved = path.resolve(base, userInput);   // collapse all "../"
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Path traversal blocked");       // escaped the sandbox
  }
  return resolved;
}

app.get("/download", (req, res) => {
  try {
    const filePath = safeJoin(BASE, req.query.name); // ✅ verified inside BASE
    res.sendFile(filePath);
  } catch {
    res.status(403).send("Forbidden");
  }
});`,
  },

  sandbox: {
    intro: `
      <p>This simulates a <code>/download?name=…</code> route serving files from
      <code>${BASE}</code>. Type a filename, or pick an attack below, and watch
      how the path resolves. Flip the toggle to see the patched version reject
      the exact same input.</p>
    `,
    inputLabel: "Requested file name (the ?name= value)",
    placeholder: "e.g. avatar.png",
    default: "avatar.png",
    presets: [
      { label: "avatar.png (legit)", value: "avatar.png" },
      { label: "../ .env (secrets)", value: "../.env" },
      { label: "escape to /etc/passwd", value: "../../../../etc/passwd" },
      { label: "steal SSH key", value: "../../../home/app/.ssh/id_rsa" },
      { label: "Zip Slip entry", value: "../../../../etc/passwd" },
    ],

    run(input, { patched }) {
      const r = patched ? serveFilePatched(input) : serveFileVulnerable(input);

      const steps = [
        { label: "Sandbox base dir", value: BASE },
        { label: "Attacker input", value: input || "(empty)" },
        { label: "path.join(base, input)", value: r.resolved },
        {
          label: "Resolved path inside base?",
          value: r.escaped ? "NO — escaped the sandbox" : "yes",
          flag: r.escaped ? "bad" : "good",
        },
      ];

      // PATCHED + escaped → blocked before any read happens.
      if (r.blocked) {
        steps.push({ label: "Server action", value: "403 Forbidden — request rejected", flag: "good" });
        return {
          verdict: "blocked",
          steps,
          note:
            "The patched safeJoin() resolved the path, saw it landed outside the " +
            "base directory, and refused before reading anything.",
        };
      }

      // A read happens (either legit, or — in vulnerable mode — an escape).
      if (!r.exists) {
        steps.push({ label: "Server action", value: "404 Not Found", flag: r.escaped ? "bad" : "" });
        return {
          verdict: r.escaped ? "exploited" : "safe",
          steps,
          note: r.escaped
            ? "The path escaped the sandbox; this exact technique reaches real files " +
              "that happen to exist on a target server, even though this demo path is empty."
            : "No such file in the upload directory — but the request stayed safely inside it.",
        };
      }

      const contents = FS[r.resolved];
      steps.push({ label: "Server action", value: "200 OK — file contents returned" });
      steps.push({
        label: "Bytes served to attacker",
        value: contents,
        flag: r.escaped ? "bad" : "good",
      });

      return {
        verdict: r.escaped ? "exploited" : "safe",
        steps,
        note: r.escaped
          ? "Leaked a file from OUTSIDE the upload directory. On a real server this " +
            "is how credentials, keys, and /etc/passwd get exfiltrated through a " +
            "single crafted ?name= value."
          : "Served a legitimate file from inside the upload directory — exactly as intended.",
      };
    },
  },

  references: [
    { label: "OWASP — Path Traversal", url: "https://owasp.org/www-community/attacks/Path_Traversal" },
    { label: "Snyk — Zip Slip vulnerability", url: "https://security.snyk.io/research/zip-slip-vulnerability" },
    { label: "CWE-22 — Improper Limitation of a Pathname to a Restricted Directory", url: "https://cwe.mitre.org/data/definitions/22.html" },
  ],
};
