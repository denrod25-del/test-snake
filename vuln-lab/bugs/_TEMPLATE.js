/**
 * TEMPLATE for a new Vuln Lab bug module.
 *
 * To add a bug:
 *   1. Copy this file to bugs/<your-bug-id>.js
 *   2. Fill in every field below.
 *   3. Add "../bugs/<your-bug-id>.js" to the array in js/manifest.js
 *
 * Files prefixed with "_" are ignored — they are not listed in the manifest,
 * so this template never appears in the app.
 */

// Put any pure-JS "simulated vulnerable system" helpers up here (a mock DB, a
// fake template renderer, a tiny parser, etc.). Keep everything client-side.

export default {
  // --- Metadata (drives the sidebar, badges, and routing) ---
  id: "my-bug-id", // unique, url-safe; becomes the #/my-bug-id route
  title: "Human Readable Title",
  severity: "High", // one of: Critical | High | Medium | Low
  category: "Short category label",
  cwe: "CWE-000", // optional
  summary: "One-sentence hook shown on the card and page header.",

  // --- (1) Plain-English explanation. Trusted authored HTML. ---
  explanation: `
    <p>Explain <em>why</em> the bug happens in plain English.</p>
  `,

  // --- (2) The vulnerable code pattern ---
  vulnerable: {
    lang: "javascript",
    label: "Vulnerable",
    code: `// the bad pattern`,
  },

  // --- (4) The fix: explanation + patched code ---
  fixExplanation: `<p>Explain the fix and why it works.</p>`,
  patched: {
    lang: "javascript",
    label: "Patched",
    code: `// the safe pattern`,
  },

  // --- (3) The live, simulated sandbox ---
  sandbox: {
    intro: `<p>Optional intro HTML shown above the input.</p>`,
    inputLabel: "Input label",
    placeholder: "example input",
    default: "", // optional pre-filled value
    presets: [
      { label: "Button text", value: "value inserted into the input" },
    ],

    /**
     * Pure function. Receives the user's input and the mode, returns a result
     * object the UI renders generically:
     *
     *   verdict : "exploited" | "blocked" | "safe"
     *   steps   : [{ label, value, flag?: "bad" | "good" }]   // execution trace
     *   note    : string (optional explanatory footnote)
     *   demo    : { type: "iframe", srcdoc, label } (optional rendered output —
     *             runs sandboxed with allow-scripts only; great for XSS demos)
     */
    run(input, { patched }) {
      if (patched) {
        return {
          verdict: "blocked",
          steps: [{ label: "input", value: input }],
          note: "The patched implementation neutralizes the attack.",
        };
      }
      return {
        verdict: "exploited",
        steps: [{ label: "input", value: input, flag: "bad" }],
        note: "The vulnerable implementation is exploited.",
      };
    },
  },

  // --- References (optional) ---
  references: [
    { label: "OWASP — …", url: "https://owasp.org/" },
  ],
};
