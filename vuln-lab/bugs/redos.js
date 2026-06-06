/**
 * Bug module: Regular Expression Denial of Service (ReDoS)
 *
 * Self-contained. A naive validator regex with a nested, ambiguous quantifier —
 * the classic shape /^([a-z0-9]+)+$/ — exhibits *catastrophic backtracking*:
 * against a long run of matching characters followed by ONE character that makes
 * the overall match fail, the engine explores ~2^n ways to split the run between
 * the inner and outer "+", and the match time blows up exponentially. One short
 * request string can pin a CPU core for seconds, minutes, or longer — a denial of
 * service with no payload size to speak of.
 *
 * IMPORTANT: this sandbox NEVER actually runs the vulnerable regex — doing so
 * would freeze the browser tab, which is the whole point. Instead it *models* the
 * backtracking cost analytically (2^n for the evil input shape) and reports the
 * estimated step count and wall-clock time. The PATCHED side uses a linear,
 * unambiguous regex whose cost is ~n no matter what you feed it.
 */

// The character class the nested quantifier ranges over.
const CLASS_RE = /[a-z0-9]/;

// Roughly how many simple backtracking steps a JS engine retires per second.
// Order-of-magnitude only — enough to turn a step count into a felt duration.
const STEPS_PER_SEC = 25_000_000;

// Length of the leading run of class-matching characters. The "+...+" nesting
// backtracks over exactly this prefix.
function matchablePrefixLen(s) {
  let n = 0;
  while (n < s.length && CLASS_RE.test(s[n])) n++;
  return n;
}

// Does the whole string consist solely of class characters? If so the vulnerable
// regex matches on the first try (no backtracking) — the fast, benign case.
function isAllClass(s) {
  return s.length > 0 && matchablePrefixLen(s) === s.length;
}

// Format a (possibly astronomically large) step count without overflowing to
// Infinity. For big exponents we report "about 2^n" instead of a raw number.
function formatSteps(prefixLen) {
  // Exponential blow-up: the engine tries ~2^prefixLen partitions.
  if (prefixLen <= 30) {
    const steps = Math.pow(2, prefixLen);
    return { steps, display: steps.toLocaleString("en-US") };
  }
  return { steps: Math.pow(2, prefixLen), display: `about 2^${prefixLen} (≈ 10^${Math.round(prefixLen * 0.30103)})` };
}

function formatDuration(seconds) {
  if (!isFinite(seconds)) return "effectively forever";
  if (seconds < 0.001) return "< 1 ms (instant)";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 90) return `${seconds.toFixed(1)} seconds`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`;
  const days = seconds / 86400;
  if (days < 365_000) return `${days.toLocaleString("en-US", { maximumFractionDigits: 0 })} days`;
  return `${(days / 365).toLocaleString("en-US", { maximumFractionDigits: 0 })} years`;
}

// Model the VULNERABLE regex /^([a-z0-9]+)+$/ analytically.
function analyzeVulnerable(input) {
  const prefix = matchablePrefixLen(input);
  if (input.length === 0) {
    return { kind: "empty", prefix: 0, steps: 0, seconds: 0 };
  }
  if (isAllClass(input)) {
    // Matches immediately; cost is linear in length.
    return { kind: "match", prefix, steps: input.length, seconds: input.length / STEPS_PER_SEC };
  }
  // There is at least one non-class char. If it sits AFTER a run of class chars,
  // the engine backtracks over that whole run trying to make "$" line up.
  if (prefix === 0) {
    // First char already fails — fast reject, no backtracking.
    return { kind: "fast-fail", prefix, steps: 1, seconds: 1 / STEPS_PER_SEC };
  }
  const { steps, display } = formatSteps(prefix);
  return { kind: "catastrophic", prefix, steps, stepsDisplay: display, seconds: steps / STEPS_PER_SEC };
}

// The PATCHED regex /^[a-z0-9]+$/ — no nesting, linear cost regardless of input.
function analyzePatched(input) {
  const steps = Math.max(1, input.length); // ~one step per character, single pass
  return { steps, seconds: steps / STEPS_PER_SEC, matches: isAllClass(input) };
}

// ---- Module definition ------------------------------------------------------

export default {
  id: "redos",
  title: "Regular Expression Denial of Service (ReDoS)",
  severity: "Medium",
  category: "Denial of service / availability",
  cwe: "CWE-1333",
  summary:
    "A regex with nested, ambiguous quantifiers backtracks exponentially on crafted input — a few dozen characters can hang a CPU core for minutes, taking the service down.",

  explanation: `
    <p>Most regex engines (including JavaScript's, Python's <code>re</code>, Java,
    PCRE) match by <strong>backtracking</strong>. When a pattern can match the same
    text in many different ways, a cleverly chosen input forces the engine to try
    an <em>exponential</em> number of those ways before giving up. The matcher
    isn't wrong — it's just doing a staggering amount of work.</p>
    <p>The tell-tale shape is a <strong>quantifier inside a quantifier over an
    overlapping class</strong>: <code>(a+)+</code>, <code>(a*)*</code>,
    <code>([a-z0-9]+)+</code>, <code>(\\w+\\s?)*</code>, or alternations like
    <code>(a|a)*</code>. Feed it a long run of matching characters followed by
    <em>one</em> character that makes the whole match fail, and the engine explores
    every way to divide that run between the inner and outer quantifier — roughly
    <code>2^n</code> attempts.</p>
    <p>The scary part is the economics: the malicious input is <em>tiny</em> (30–40
    characters), so it sails past body-size limits, yet it can peg a core for
    seconds to hours. A handful of such requests starves the thread pool and the
    whole service stops responding — denial of service with almost no bandwidth.</p>
  `,

  vulnerable: {
    lang: "javascript",
    label: "Vulnerable — nested quantifier, exponential backtracking",
    code: `// "Validate" a username/slug. Looks innocent; it is not.
const re = /^([a-z0-9]+)+$/;

function isValidUsername(name) {
  return re.test(name);          // hangs on "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
}

// The ( ...+ )+ nesting means the run of a's can be split between the inner
// and outer "+" in 2^n ways. Add a trailing "!" so the overall match fails,
// and the engine tries them ALL before returning false. ~40 chars -> days.`,
  },

  fixExplanation: `
    <p>Make the work linear and bound it:</p>
    <ul>
      <li><strong>Remove the ambiguity.</strong> The nested quantifier is
        pointless here — <code>/^[a-z0-9]+$/</code> matches exactly the same
        strings with no backtracking. Flatten <code>(X+)+</code> to
        <code>X+</code>, and avoid overlapping alternations.</li>
      <li><strong>Cap the input length</strong> before matching
        (<code>if (s.length &gt; 64) reject</code>). Even a bad regex can't blow up
        on input it never sees.</li>
      <li><strong>Use a non-backtracking engine</strong> for untrusted input —
        Rust's <code>regex</code>, Go's <code>regexp</code> (RE2), or Node's
        <code>node:re2</code> binding run in guaranteed linear time.</li>
      <li><strong>Or run with a timeout</strong> / in a worker you can kill, so a
        pathological match can't take the request thread down with it.</li>
    </ul>
    <p>Lint for it: tools like <em>eslint-plugin-regexp</em> /
    <em>redos-detector</em> flag these patterns in CI.</p>
  `,
  patched: {
    lang: "javascript",
    label: "Patched — linear regex + length cap",
    code: `// Same accepted strings, no nesting => single linear pass, no backtracking.
const re = /^[a-z0-9]+$/;

function isValidUsername(name) {
  if (typeof name !== "string" || name.length > 64) return false; // bound the work
  return re.test(name);
}

// For untrusted input at scale, prefer a linear-time engine (RE2):
//   const RE2 = require("re2");
//   const re = new RE2("^[a-z0-9]+$");`,
  },

  sandbox: {
    intro: `
      <p>The validator is <code>/^([a-z0-9]+)+$/</code>. Type a run of letters/
      digits and end it with a character that's <em>not</em> in the class (like
      <code>!</code>) to trigger the blow-up. In <em>Vulnerable</em> mode this
      panel <strong>models</strong> the engine's backtracking cost (it does
      <em>not</em> actually run the evil regex — that would freeze this tab) and
      reports the estimated steps and time. Flip to <em>Patched</em> and the linear
      regex stays instant no matter how long the input is. Try the presets and
      watch the time explode as you add a few characters.</p>
    `,
    inputLabel: "Username to validate",
    placeholder: "e.g. alice123",
    default: "aaaaaaaaaaaaaaaaaaaaaaaaaa!",
    presets: [
      { label: "alice123 (valid, fast)", value: "alice123" },
      { label: "20 a's + ! (slow)", value: "aaaaaaaaaaaaaaaaaaaa!" },
      { label: "28 a's + ! (very slow)", value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!" },
      { label: "40 a's + ! (hangs)", value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" },
      { label: "!immediate fail (fast)", value: "!hello" },
    ],

    run(input, { patched }) {
      try {
        input = typeof input === "string" ? input : String(input);
      } catch {
        input = "";
      }

      if (patched) {
        const lengthCapped = input.length > 64;
        const a = analyzePatched(input);
        const steps = [
          { label: "Regex", value: "/^[a-z0-9]+$/  (no nesting)" },
          { label: "Input length", value: `${input.length} chars` },
        ];
        if (lengthCapped) {
          steps.push({ label: "Length cap (> 64)", value: "rejected before matching", flag: "good" });
          return {
            verdict: "blocked",
            steps,
            note: "Over the length cap, so it's rejected without even running the regex — the work is bounded up front.",
          };
        }
        steps.push({ label: "Backtracking", value: "none — single linear pass", flag: "good" });
        steps.push({ label: "Estimated steps", value: a.steps.toLocaleString("en-US"), flag: "good" });
        steps.push({ label: "Estimated time", value: formatDuration(a.seconds), flag: "good" });
        steps.push({ label: "Valid username?", value: a.matches ? "yes" : "no" });
        return {
          verdict: "safe",
          steps,
          note: "The flattened regex accepts exactly the same usernames but can't backtrack, so even the 40-a's payload returns in microseconds. Same result, linear cost.",
        };
      }

      // Vulnerable path — analyzed, never executed.
      const a = analyzeVulnerable(input);
      const steps = [
        { label: "Regex", value: "/^([a-z0-9]+)+$/  (nested +)" },
        { label: "Input", value: input.length > 50 ? input.slice(0, 50) + "…" : input || "(empty)" },
      ];

      if (a.kind === "empty") {
        return { verdict: "safe", steps, note: "Empty input — nothing to backtrack over." };
      }
      if (a.kind === "match") {
        steps.push({ label: "Matchable prefix", value: `${a.prefix} chars — whole string is valid`, flag: "good" });
        steps.push({ label: "Backtracking", value: "none — matches on the first attempt", flag: "good" });
        steps.push({ label: "Estimated time", value: formatDuration(a.seconds), flag: "good" });
        return {
          verdict: "safe",
          steps,
          note: "An all-valid string matches immediately, so this input is cheap — but the same regex is one trailing \"!\" away from catastrophe.",
        };
      }
      if (a.kind === "fast-fail") {
        steps.push({ label: "First char in [a-z0-9]?", value: "no — fails instantly, nothing to backtrack", flag: "good" });
        steps.push({ label: "Estimated time", value: formatDuration(a.seconds), flag: "good" });
        return {
          verdict: "safe",
          steps,
          note: "The mismatch is at the very start, so the engine bails immediately. The blow-up needs a long run of matching chars BEFORE the failing one.",
        };
      }

      // catastrophic
      steps.push({ label: "Matchable prefix", value: `${a.prefix} chars of [a-z0-9], then a non-matching char`, flag: "bad" });
      steps.push({ label: "Ways to split the prefix", value: `~2^${a.prefix}`, flag: "bad" });
      steps.push({ label: "Estimated backtracking steps", value: a.stepsDisplay, flag: "bad" });
      steps.push({ label: "Estimated time to return false", value: formatDuration(a.seconds), flag: "bad" });
      return {
        verdict: "exploited",
        steps,
        note:
          "Catastrophic backtracking: a " +
          (input.length) +
          "-character string makes the engine try about 2^" + a.prefix + " partitions before " +
          "returning false, pinning a CPU core for " + formatDuration(a.seconds) + ". A few such " +
          "requests exhaust the server's threads and the whole service stops responding. " +
          "(This panel computed the cost — it did not actually run the regex.)",
      };
    },
  },

  references: [
    { label: "OWASP — Regular Expression Denial of Service (ReDoS)", url: "https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS" },
    { label: "OWASP Cheat Sheet — ReDoS", url: "https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html" },
    { label: "CWE-1333 — Inefficient Regular Expression Complexity", url: "https://cwe.mitre.org/data/definitions/1333.html" },
    { label: "Cloudflare — the regex that took down their service (2019)", url: "https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/" },
  ],
};
