/**
 * The bug manifest — the single list you append to when adding a new module.
 *
 * To add bug #11:
 *   1. Copy `bugs/_TEMPLATE.js` to `bugs/my-new-bug.js` and fill it in.
 *   2. Add its path to the array below.
 * That's it — no other file needs to change.
 *
 * Order here = order shown within each severity group in the sidebar.
 */
export const BUG_MODULES = [
  "../bugs/path-traversal.js",
  "../bugs/sql-injection.js",
  "../bugs/xss.js",
  "../bugs/os-command-injection.js",
  "../bugs/ssrf.js",
  // "../bugs/xss.js",
  // "../bugs/os-command-injection.js",
  // "../bugs/ssrf.js",
  // "../bugs/xxe.js",
  // "../bugs/insecure-deserialization.js",
  // "../bugs/csrf.js",
  // "../bugs/open-redirect.js",
  // "../bugs/redos.js",
];
