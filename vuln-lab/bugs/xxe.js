/**
 * Bug module: XML External Entity (XXE)
 *
 * Self-contained. The sandbox simulates an XML import endpoint that parses
 * user-submitted XML and echoes a field back. A small mock XML engine (below)
 * parses the DOCTYPE's entity declarations, resolves external SYSTEM entities
 * against a mock filesystem / the metadata service, and detects billion-laughs
 * expansion analytically (without actually expanding it). The VULNERABLE parser
 * resolves entities and DTDs; the PATCHED parser disallows DOCTYPE declarations
 * (secure processing), so the same payload is rejected before any entity runs.
 */

// ---- Mock resources reachable by external entities --------------------------
const RESOURCES = {
  "file:///etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "file:///etc/shadow": "root:$6$rounds=656000$abc...:19000:0:99999:7:::",
  "file:///c:/windows/win.ini": "[fonts]\n[extensions]\n[mci extensions]\n[files]\n; for 16-bit app support",
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/web-role":
    '{"AccessKeyId":"ASIAIOSFODNN7EXAMPLE","SecretAccessKey":"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY","Token":"IQoJb3JpZ2luX2VjEND...=="}',
};
function fetchResource(uri) {
  return uri in RESOURCES ? RESOURCES[uri] : `(could not retrieve ${uri})`;
}

// ---- A tiny XML/DTD engine --------------------------------------------------

function hasDoctype(xml) {
  return /<!DOCTYPE/i.test(xml);
}

// Pull the internal subset "[ ... ]" out of the DOCTYPE, plus any external DTD.
function getDoctype(xml) {
  const internal = xml.match(/<!DOCTYPE\s+\S+\s*\[([\s\S]*?)\]\s*>/i);
  const externalDtd = xml.match(/<!DOCTYPE\s+\S+\s+(?:SYSTEM|PUBLIC)\s+[^>\[]*>/i);
  return { internalSubset: internal ? internal[1] : "", externalDtd: externalDtd ? externalDtd[0] : null };
}

// Parse <!ENTITY ...> declarations from the internal subset.
function parseEntities(subset) {
  const entities = {};
  const re = /<!ENTITY\s+(%\s+)?([A-Za-z_][\w.-]*)\s+(?:SYSTEM\s+"([^"]*)"|PUBLIC\s+"[^"]*"\s+"([^"]*)"|"([^"]*)")\s*>/g;
  let m;
  while ((m = re.exec(subset))) {
    const [, isParam, name, sysUri, pubUri, literal] = m;
    const uri = sysUri || pubUri;
    entities[name] = uri
      ? { type: "external", uri, param: !!isParam }
      : { type: "internal", value: literal, param: !!isParam };
  }
  return entities;
}

// Analytically compute how large `&name;` expands to, WITHOUT expanding it, so
// billion-laughs is detected without doing exponential work or hanging.
function expansionSize(name, entities, memo, depth) {
  if (depth > 60) return Infinity;
  const ent = entities[name];
  if (!ent) return name.length + 2;
  if (ent.type === "external") return 256; // external content size estimate
  if (memo[name] != null) return memo[name];
  memo[name] = 0; // guard against self-reference cycles
  let size = 0;
  const parts = ent.value.split(/&([A-Za-z_][\w.-]*);/);
  for (let i = 0; i < parts.length; i++) {
    size += i % 2 === 0 ? parts[i].length : expansionSize(parts[i], entities, memo, depth + 1);
    if (size > 1e12) { size = Infinity; break; }
  }
  memo[name] = size;
  return size;
}

const EXPANSION_LIMIT = 1_000_000; // ~1 MB projected = treat as a DoS payload

// Expand entity references in the body. Returns leaked content + what it touched.
function processXml(xml) {
  const doctype = hasDoctype(xml);
  const { internalSubset, externalDtd } = getDoctype(xml);
  const entities = parseEntities(internalSubset);
  const body = xml
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!DOCTYPE[\s\S]*?\]\s*>/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>/i, "")
    .trim();

  const refs = [...body.matchAll(/&([A-Za-z_][\w.-]*);/g)].map((m) => m[1]);

  // Billion-laughs check (analytical, no expansion performed).
  const memo = {};
  let projected = 0;
  for (const r of refs) projected += expansionSize(r, entities, memo, 0);
  if (projected > EXPANSION_LIMIT) {
    return { doctype, entities, dos: true, projected, external: [], body };
  }

  // Bounded expansion (safe — projected size is under the limit).
  const external = [];
  let out = body;
  for (let i = 0; i < 60; i++) {
    let changed = false;
    out = out.replace(/&([A-Za-z_][\w.-]*);/g, (whole, n) => {
      const e = entities[n];
      if (!e) return whole;
      changed = true;
      if (e.type === "external") {
        external.push(e.uri);
        return fetchResource(e.uri);
      }
      return e.value;
    });
    if (!changed) break;
  }
  return { doctype, entities, dos: false, external: [...new Set(external)], expanded: out, body, externalDtd };
}

function entityList(entities) {
  const names = Object.keys(entities);
  if (!names.length) return "(none)";
  return names
    .map((n) => `${entities[n].param ? "% " : ""}${n} = ${entities[n].type === "external" ? `SYSTEM ${entities[n].uri}` : `"${entities[n].value}"`}`)
    .join("\n");
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "xxe",
  title: "XML External Entity (XXE)",
  severity: "High",
  category: "Injection / XML processing",
  cwe: "CWE-611",
  summary:
    "An XML parser that resolves external entities lets attacker XML read local files, hit internal services (SSRF), or exhaust memory (billion laughs).",

  explanation: `
    <p>XXE happens when an application parses untrusted XML with a parser that
    <strong>resolves external entities and DTDs</strong> — which many XML parsers
    do <em>by default</em>. XML lets a document define entities in a
    <code>&lt;!DOCTYPE&gt;</code>, and an entity can point at an external
    resource:</p>
    <p><code>&lt;!ENTITY xxe SYSTEM "file:///etc/passwd"&gt;</code> — now every
    <code>&amp;xxe;</code> in the document is replaced with the contents of that
    file. If the app echoes the parsed value back (or includes it in an error),
    the file leaks straight out.</p>
    <p>The same trick reaches further: <code>SYSTEM "http://169.254.169.254/…"</code>
    turns XXE into <strong>SSRF</strong> against internal services and cloud
    metadata. And purely-internal recursive entities cause the
    <strong>"billion laughs"</strong> denial of service — a few nested entities
    that expand to gigabytes and exhaust memory.</p>
    <p>It shows up anywhere XML is accepted: SOAP APIs, SAML, SVG/DOCX/XLSX
    uploads, sitemaps, RSS, config import. The danger is the parser's default,
    not anything exotic in the request.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — entity & DTD resolution enabled",
    code: `const libxml = require("libxmljs2");

app.post("/import", (req, res) => {
  // ❌ noent:true substitutes entities; dtdload/nonet allow external fetches
  const doc = libxml.parseXml(req.body, { noent: true, dtdload: true, nonet: false });
  res.send(doc.get("//name").text());      // echoes the (expanded) value back
});

// Java equivalent of the same mistake — a default DocumentBuilderFactory:
//   DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(input);`,
  },

  fixExplanation: `
    <p>Configure the parser to <strong>not process DTDs or external entities</strong>.
    The strongest, simplest setting is to <strong>disallow DOCTYPE declarations
    entirely</strong> — almost no legitimate API input needs one, and it kills
    file reads, SSRF, and billion-laughs in one move.</p>
    <ul>
      <li><strong>libxml2 / libxmljs:</strong> <code>noent: false</code>,
        <code>dtdload: false</code>, <code>nonet: true</code>, and reject input
        containing <code>&lt;!DOCTYPE&gt;</code>.</li>
      <li><strong>Java:</strong> <code>factory.setFeature(
        "http://apache.org/xml/features/disallow-doctype-decl", true)</code>
        (plus disable external general/parameter entities).</li>
      <li><strong>.NET / Python (lxml/defusedxml):</strong> use the hardened
        defaults — Python's <code>defusedxml</code> blocks all of this.</li>
    </ul>
    <p>And don't reflect parsed XML or raw parser errors back to the user.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — disallow DOCTYPE / external entities",
    code: `app.post("/import", (req, res) => {
  // ✅ strongest, simplest defense: refuse any document with a DTD
  if (/<!DOCTYPE/i.test(req.body)) {
    return res.status(400).send("DTD / DOCTYPE not allowed");
  }
  const doc = libxml.parseXml(req.body, {
    noent: false,    // ✅ do not substitute entities
    dtdload: false,  // ✅ do not load external DTDs
    nonet: true,     // ✅ no network access during parse
  });
  res.send(doc.get("//name").text());
});`,
  },

  sandbox: {
    multiline: true,
    intro: `
      <p>This simulates an XML import endpoint that parses your XML and echoes the
      <code>&lt;name&gt;</code> field. In <em>Vulnerable</em> mode the parser
      resolves entities — point one at a file or the metadata service and watch it
      come back in the response. Flip to <em>Patched</em> and the same document is
      rejected because it declares a <code>&lt;!DOCTYPE&gt;</code>. (Press
      <kbd>Ctrl/Cmd+Enter</kbd> to run.)</p>
    `,
    inputLabel: "XML document to import",
    placeholder: "<user><name>Alice</name></user>",
    default: "<user><name>Alice</name></user>",
    presets: [
      { label: "benign XML", value: "<user>\n  <name>Alice</name>\n</user>" },
      {
        label: "read /etc/passwd",
        value:
          '<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "file:///etc/passwd">\n]>\n<user><name>&xxe;</name></user>',
      },
      {
        label: "XXE → cloud metadata (SSRF)",
        value:
          '<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/web-role">\n]>\n<user><name>&xxe;</name></user>',
      },
      {
        label: "read Windows win.ini",
        value:
          '<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">\n]>\n<user><name>&xxe;</name></user>',
      },
      {
        label: "billion laughs (DoS)",
        value:
          '<?xml version="1.0"?>\n<!DOCTYPE lolz [\n  <!ENTITY lol "lol">\n  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">\n  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">\n  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">\n  <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">\n  <!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;">\n  <!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;">\n  <!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;">\n  <!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">\n]>\n<lolz>&lol9;</lolz>',
      },
      {
        label: "internal entity (no external access)",
        value:
          '<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY company "ACME Corp">\n]>\n<user><name>&company;</name></user>',
      },
    ],

    run(input, { patched }) {
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }
      if (!input.trim()) {
        return { verdict: "safe", steps: [{ label: "Submitted XML", value: "(empty)" }], note: "Nothing submitted — nothing parsed." };
      }

      const r = processXml(input);

      if (patched) {
        const steps = [
          { label: "Submitted XML", value: input },
          { label: "Parser config", value: "DOCTYPE disallowed · noent:false · dtdload:false · nonet:true", flag: "good" },
        ];
        if (r.doctype) {
          steps.push({ label: "Contains <!DOCTYPE>?", value: "yes — REJECTED before parsing", flag: "good" });
          return {
            verdict: "blocked",
            steps,
            note:
              "Refused: the document declares a DTD, and the hardened parser rejects DOCTYPE " +
              "outright. No entity is ever defined or resolved — so file reads, SSRF, and " +
              "billion-laughs are all off the table in one check.",
          };
        }
        steps.push({ label: "Contains <!DOCTYPE>?", value: "no — parsed as plain XML", flag: "good" });
        return {
          verdict: "safe",
          steps,
          note: "Plain XML with no DTD parses normally — the intended use, with entity processing disabled.",
        };
      }

      // Vulnerable path
      const steps = [
        { label: "Submitted XML", value: input },
        { label: "DOCTYPE / DTD present?", value: r.doctype ? "yes — entities will be processed" : "no", flag: r.doctype ? "bad" : "good" },
        { label: "Entities declared", value: entityList(r.entities) },
      ];

      if (r.dos) {
        const mb = Math.round(r.projected / 1_000_000);
        steps.push({ label: "Expansion analysis", value: `recursive entities expand to ~${mb.toLocaleString()} MB before any output`, flag: "bad" });
        steps.push({ label: "Result", value: "parser allocates until memory is exhausted — denial of service", flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note:
            "Billion Laughs: a handful of nested entities expand exponentially (here ~" + mb +
            " MB) and exhaust the server's memory. The fix here didn't expand it — it computed " +
            "the size and refused.",
        };
      }

      if (r.external.length) {
        steps.push({ label: "External resources fetched", value: r.external.join("\n"), flag: "bad" });
        steps.push({ label: "Parsed <name> (entity expanded)", value: r.expanded, flag: "bad" });
        const isSsrf = r.external.some((u) => u.startsWith("http"));
        return {
          verdict: "exploited",
          steps,
          note: isSsrf
            ? "XXE became SSRF: the parser fetched an internal URL and handed back the response — " +
              "here, live cloud credentials. The same entity could read local files instead."
            : "XXE file disclosure: the parser read a file off the server's disk and substituted its " +
              "contents into the document, which the app echoed straight back to the attacker.",
        };
      }

      // DTD present but only internal/benign entities, or no entities.
      steps.push({ label: "Parsed <name> (entity expanded)", value: r.expanded, flag: r.doctype ? undefined : "good" });
      return {
        verdict: "safe",
        steps,
        note: r.doctype
          ? "This document only uses internal entities, so nothing external was reached — but the " +
            "parser still resolves DTDs, so it's one SYSTEM entity away from the attacks above. " +
            "(The patched parser rejects it outright for exactly this reason.)"
          : "Plain XML, no entities to resolve — handled normally.",
      };
    },
  },

  references: [
    { label: "OWASP — XML External Entity (XXE) Processing", url: "https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing" },
    { label: "OWASP — XXE Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html" },
    { label: "PortSwigger — XML external entity (XXE) injection", url: "https://portswigger.net/web-security/xxe" },
    { label: "CWE-611 — Improper Restriction of XML External Entity Reference", url: "https://cwe.mitre.org/data/definitions/611.html" },
  ],
};
