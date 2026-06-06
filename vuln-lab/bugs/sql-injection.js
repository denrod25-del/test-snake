/**
 * Bug module: SQL Injection
 *
 * Self-contained. The sandbox simulates a "find user" admin endpoint that looks
 * a row up by username. The VULNERABLE path builds the SQL by concatenating the
 * user's input into the query string; the PATCHED path uses a parameterized
 * query. A tiny but real SQL evaluator (tokenizer → parser → per-row evaluator,
 * below) actually executes the constructed query against a mock in-memory table,
 * so injected payloads genuinely alter the result — nothing is faked.
 */

// ---- Mock in-memory database -----------------------------------------------
// (Plaintext passwords here only to make the "table dump" leak vivid; real apps
// must store salted hashes — but injection would dump those hashes just the same.)
const USERS = [
  { id: 1, username: "admin", password: "S3cr3t-Admin!", role: "admin" },
  { id: 2, username: "alice", password: "alice-hunter2", role: "user" },
  { id: 3, username: "bob", password: "bobpassword99", role: "user" },
];

// ---- A tiny SQL engine for: SELECT <cols> FROM <table> [WHERE <expr>] -------

class SqlError extends Error {}

function tokenize(sql) {
  const toks = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "-" && sql[i + 1] === "-") break; // "--" comment runs to end of line
    if (c === "'") {
      // string literal; '' is not treated as an escape (kept deliberately simple)
      let j = i + 1, val = "", closed = false;
      while (j < sql.length) {
        if (sql[j] === "'") { closed = true; j++; break; }
        val += sql[j++];
      }
      if (!closed) throw new SqlError("unterminated string literal — unbalanced quote");
      toks.push({ type: "str", value: val });
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i, num = "";
      while (j < sql.length && /[0-9]/.test(sql[j])) num += sql[j++];
      toks.push({ type: "num", value: Number(num) });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i, id = "";
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) id += sql[j++];
      toks.push({ type: "ident", value: id });
      i = j; continue;
    }
    if (c === "=") { toks.push({ type: "op", value: "=" }); i++; continue; }
    if (c === "(") { toks.push({ type: "lparen" }); i++; continue; }
    if (c === ")") { toks.push({ type: "rparen" }); i++; continue; }
    if (c === ",") { toks.push({ type: "comma" }); i++; continue; }
    if (c === "*") { toks.push({ type: "star" }); i++; continue; }
    throw new SqlError(`syntax error near '${c}'`);
  }
  return toks;
}

function parse(sql) {
  const toks = tokenize(sql);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const isKw = (t, kw) => t && t.type === "ident" && t.value.toUpperCase() === kw;
  const expectKw = (kw) => {
    if (!isKw(peek(), kw)) throw new SqlError(`expected ${kw}`);
    next();
  };

  expectKw("SELECT");
  // consume the select list (we don't need its shape — the structure is fixed)
  while (peek() && !isKw(peek(), "FROM")) next();
  expectKw("FROM");
  if (!peek() || peek().type !== "ident") throw new SqlError("expected table name");
  const table = next().value;

  let where = null;
  if (isKw(peek(), "WHERE")) { next(); where = parseOr(); }
  if (peek()) throw new SqlError(`unexpected token after query`);
  return { table, where };

  function parseOr() {
    let node = parseAnd();
    while (isKw(peek(), "OR")) { next(); node = { t: "or", l: node, r: parseAnd() }; }
    return node;
  }
  function parseAnd() {
    let node = parseCmp();
    while (isKw(peek(), "AND")) { next(); node = { t: "and", l: node, r: parseCmp() }; }
    return node;
  }
  function parseCmp() {
    const l = parsePrimary();
    if (peek() && peek().type === "op") { next(); return { t: "cmp", l, r: parsePrimary() }; }
    return l;
  }
  function parsePrimary() {
    const t = peek();
    if (!t) throw new SqlError("unexpected end of query");
    if (t.type === "lparen") { next(); const e = parseOr(); if (!peek() || peek().type !== "rparen") throw new SqlError("missing )"); next(); return e; }
    if (t.type === "str") { next(); return { t: "val", kind: "str", value: t.value }; }
    if (t.type === "num") { next(); return { t: "val", kind: "num", value: t.value }; }
    if (t.type === "ident") { next(); return { t: "val", kind: "col", value: t.value }; }
    throw new SqlError("expected a value");
  }
}

function resolve(node, row) {
  if (node.t === "val") {
    if (node.kind === "col") {
      // A real database rejects references to columns that don't exist, rather
      // than silently treating them as NULL — so model that. (Without this,
      // "a = a" would compare undefined == undefined and wrongly match.)
      if (!(node.value in row)) throw new SqlError(`no such column: ${node.value}`);
      return row[node.value];
    }
    return node.value; // literal string/number
  }
  return toBool(evaluate(node, row)); // a parenthesized/boolean subexpression
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v !== "0";
  return false;
}
function evaluate(node, row) {
  switch (node.t) {
    case "or": return toBool(evaluate(node.l, row)) || toBool(evaluate(node.r, row));
    case "and": return toBool(evaluate(node.l, row)) && toBool(evaluate(node.r, row));
    case "cmp": return resolve(node.l, row) == resolve(node.r, row); // eslint-disable-line eqeqeq
    case "val": return resolve(node, row);
  }
  return false;
}

/** Execute a SELECT against USERS. Throws SqlError on malformed SQL. */
function executeSql(sql) {
  const ast = parse(sql);
  if (ast.table !== "users") throw new SqlError(`no such table: ${ast.table}`);
  if (!ast.where) return USERS.slice();
  return USERS.filter((row) => toBool(evaluate(ast.where, row)));
}

// ---- The two implementations the sandbox runs against ----------------------

const TEMPLATE_PREFIX = "SELECT id, username, password, role FROM users WHERE username = ";

// VULNERABLE: splice the raw input straight into the SQL string.
function lookupVulnerable(input) {
  const sql = `${TEMPLATE_PREFIX}'${input}'`;
  try {
    return { sql, rows: executeSql(sql), error: null };
  } catch (err) {
    return { sql, rows: [], error: err.message };
  }
}

// PATCHED: the value is bound as a parameter — the driver never parses it as
// SQL, so we model it as a plain literal-equality match (no parsing at all).
function lookupPatched(input) {
  const rows = USERS.filter((row) => row.username === input);
  return { sql: `${TEMPLATE_PREFIX}?`, param: input, rows, error: null };
}

function sameRowSet(a, b) {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((r) => r.id));
  return b.every((r) => ids.has(r.id));
}
function formatRows(rows) {
  if (!rows.length) return "(0 rows)";
  return rows.map((r) => `${r.id} | ${r.username} | ${r.password} | ${r.role}`).join("\n");
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "sql-injection",
  title: "SQL Injection",
  severity: "Critical",
  category: "Injection",
  cwe: "CWE-89",
  summary:
    "Building SQL by concatenating untrusted input lets an attacker rewrite the query — bypassing logic, dumping tables, or worse.",

  explanation: `
    <p>SQL injection happens when an application builds a database query by
    <strong>gluing untrusted input directly into the SQL string</strong>. The
    database receives one finished string and has no way to tell which parts were
    meant as <em>code</em> (the query structure) and which were meant as
    <em>data</em> (your value).</p>
    <p>That boundary lives entirely in a pair of quotes. The moment an attacker's
    input contains a <code>'</code>, it closes the string early and everything
    after it is parsed as <em>SQL</em>. A username like
    <code>' OR 1=1 --</code> turns a lookup for one user into
    <code>WHERE username = '' OR 1=1</code> — which is true for every row — and
    the trailing <code>--</code> comments out the rest of the query.</p>
    <p>The impact ranges from authentication bypass and dumping entire tables
    (including password hashes) to, with stacked queries or database-specific
    features, writing files or running commands. It is consistently one of the
    most damaging and widespread web vulnerabilities.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — string concatenation",
    code: `app.get("/users/find", (req, res) => {
  // ❌ the raw query param is concatenated straight into the SQL
  const sql =
    "SELECT id, username, password, role FROM users " +
    "WHERE username = '" + req.query.q + "'";

  // The DB sees ONE finished string. A quote in req.query.q ends the
  // literal early and the rest is executed as SQL.
  db.query(sql, (err, rows) => res.json(rows));
});`,
  },

  fixExplanation: `
    <p>Use <strong>parameterized queries</strong> (prepared statements). You send
    the query <em>structure</em> with <code>?</code> / <code>$1</code> placeholders
    and the <em>values</em> separately; the database driver guarantees each value
    is treated as pure data and never parsed as SQL — so quotes, <code>OR 1=1</code>,
    and <code>--</code> are just harmless characters in a username.</p>
    <p>Things that are <em>not</em> a fix: escaping quotes by hand (bypassable),
    blocklisting keywords, or wrapping input in more quotes. For parts that can't
    be parameterized (table/column names, <code>ORDER BY</code> direction),
    validate against a strict allow-list. Also apply least-privilege DB accounts
    and an ORM's parameter binding as defense in depth.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — parameterized query",
    code: `app.get("/users/find", (req, res) => {
  // ✅ placeholder for the value; the value is passed separately
  const sql =
    "SELECT id, username, password, role FROM users WHERE username = ?";

  // The driver binds req.query.q as DATA — it is never parsed as SQL,
  // so "' OR 1=1 --" is just an (unmatched) username string.
  db.query(sql, [req.query.q], (err, rows) => res.json(rows));
});`,
  },

  sandbox: {
    intro: `
      <p>This simulates an admin "find user" endpoint:
      <code>SELECT … FROM users WHERE username = '&lt;your input&gt;'</code>, run
      against a mock 3-row table. Type a username or pick an attack, then flip the
      toggle to watch the parameterized version treat the same payload as a
      harmless literal.</p>
    `,
    inputLabel: "Username to look up (the ?q= value)",
    placeholder: "e.g. alice",
    default: "alice",
    presets: [
      { label: "alice (legit)", value: "alice" },
      { label: "dump table: ' OR 1=1 --", value: "' OR 1=1 --" },
      { label: "target admin: admin' --", value: "admin' --" },
      { label: "always-true: ' OR '1'='1' --", value: "' OR '1'='1' --" },
      { label: "error-based: '", value: "'" },
    ],

    run(input, { patched }) {
      // The UI always passes a string (from a text field); coerce defensively
      // so a non-string never reaches the string-building below.
      input = typeof input === "string" ? input : String(input);
      // Evaluate the vulnerable query in both modes: in patched mode its outcome
      // is only used to decide whether this input WAS an attack (→ "blocked") or
      // simply benign (→ "safe"). lookupVulnerable can't throw — it wraps errors.
      const v = lookupVulnerable(input);
      const intended = USERS.filter((r) => r.username === input);
      const exploited = !!v.error || !sameRowSet(v.rows, intended);

      if (patched) {
        const p = lookupPatched(input);
        const steps = [
          { label: "Parameterized query", value: p.sql, flag: "good" },
          { label: "Bound parameter (?)", value: JSON.stringify(p.param), flag: "good" },
          { label: "Treated as", value: "a literal username value — never parsed as SQL" },
          { label: "Rows returned", value: String(p.rows.length) },
          { label: "Result set", value: formatRows(p.rows) },
        ];
        return {
          verdict: exploited ? "blocked" : "safe",
          steps,
          note: exploited
            ? "Same payload, neutralized: the driver bound it as a literal username " +
              "string, found no user with that exact name, and returned 0 rows. The " +
              "query structure was fixed before any value was attached."
            : p.rows.length
            ? "Legitimate lookup — the value matched a real username and returned only " +
              "that row, exactly as intended."
            : "No user has that exact name, so 0 rows came back. The value was bound as " +
              "a literal, so even if it were a payload there was nothing to exploit.",
        };
      }

      // Vulnerable path
      const steps = [
        { label: "Your input", value: input || "(empty)" },
        { label: "Query built by concatenation", value: v.sql, flag: "bad" },
      ];

      if (v.error) {
        steps.push({ label: "Database error", value: v.error, flag: "bad" });
        return {
          verdict: "exploited",
          steps,
          note:
            "Your input broke out of the string literal and corrupted the SQL syntax. " +
            "A real database would return this error to the app — error-based SQL " +
            "injection uses exactly this to map the database and extract data one " +
            "message at a time.",
        };
      }

      steps.push({ label: "Rows returned", value: String(v.rows.length), flag: exploited ? "bad" : "good" });
      steps.push({ label: "Result set (leaked)", value: formatRows(v.rows), flag: exploited ? "bad" : "good" });

      return {
        verdict: exploited ? "exploited" : "safe",
        steps,
        note: exploited
          ? `Injection succeeded: a lookup that should return ${intended.length} row(s) ` +
            `returned ${v.rows.length}. The attacker rewrote the WHERE clause and walked ` +
            "off with rows (and passwords) they were never supposed to see."
          : "The input matched a real username and behaved like a normal lookup — but " +
            "the query is still built by concatenation, so it is one quote away from the " +
            "attacks above.",
      };
    },
  },

  references: [
    { label: "OWASP — SQL Injection", url: "https://owasp.org/www-community/attacks/SQL_Injection" },
    { label: "OWASP — Query Parameterization Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html" },
    { label: "PortSwigger — SQL injection", url: "https://portswigger.net/web-security/sql-injection" },
    { label: "CWE-89 — SQL Injection", url: "https://cwe.mitre.org/data/definitions/89.html" },
  ],
};
