/**
 * Registry — loads every module listed in the manifest and exposes a
 * normalized, validated list of bug definitions to the rest of the app.
 *
 * Modules are loaded dynamically so the rest of the app never imports an
 * individual bug file by name. Adding a bug touches only `manifest.js`.
 */
import { BUG_MODULES } from "./manifest.js";

export const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"];

const REQUIRED_FIELDS = ["id", "title", "severity", "summary"];

function validate(def, source) {
  for (const f of REQUIRED_FIELDS) {
    if (!def[f]) throw new Error(`Bug module "${source}" is missing field: ${f}`);
  }
  if (!SEVERITY_ORDER.includes(def.severity)) {
    throw new Error(
      `Bug module "${source}" has unknown severity "${def.severity}". ` +
        `Use one of: ${SEVERITY_ORDER.join(", ")}`
    );
  }
  if (def.sandbox && typeof def.sandbox.run !== "function") {
    throw new Error(`Bug module "${source}" has a sandbox without a run() function.`);
  }
  return def;
}

/** Load and validate all bug modules. Returns an array of definitions. */
export async function loadBugs() {
  const settled = await Promise.allSettled(
    BUG_MODULES.map((path) => import(path).then((m) => ({ def: m.default, path })))
  );

  const bugs = [];
  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    const path = BUG_MODULES[i];
    if (res.status === "rejected") {
      console.error(`Failed to load bug module "${path}":`, res.reason);
      continue;
    }
    try {
      bugs.push(validate(res.value.def, path));
    } catch (err) {
      console.error(err.message);
    }
  }
  return bugs;
}

/** Group bugs by severity in display order. Returns [{ severity, bugs }]. */
export function groupBySeverity(bugs) {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    bugs: bugs.filter((b) => b.severity === severity),
  })).filter((g) => g.bugs.length > 0);
}
