/**
 * Generic UI helpers. These know nothing about any specific bug — they render
 * whatever the bug definition and its sandbox `run()` return. This is what
 * keeps each bug module purely data-driven.
 */

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function severityClass(sev) {
  return sev.toLowerCase();
}

/** Render a labelled code block with a copy button. `variant` = 'bad' | 'good' | ''. */
export function codeBlock(code, { lang = "", label = "", variant = "" } = {}) {
  const wrap = el(`
    <figure class="codeblock ${variant}">
      <figcaption class="code-head">
        <span>${escapeHtml(label || lang)}</span>
        <button class="copy-btn" type="button">Copy</button>
      </figcaption>
      <pre><code></code></pre>
    </figure>
  `);
  wrap.querySelector("code").textContent = code;
  wrap.querySelector(".copy-btn").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(code);
      e.target.textContent = "Copied!";
      setTimeout(() => (e.target.textContent = "Copy"), 1200);
    } catch {
      e.target.textContent = "Copy failed";
    }
  });
  return wrap;
}

/**
 * Render a sandbox result returned by a bug's `run()`:
 *   { verdict, steps:[{label,value,flag?}], output?, note?, demo? }
 *   verdict ∈ 'exploited' | 'blocked' | 'safe'
 *   demo (optional) = { type:'iframe', srcdoc, label }
 */
export function renderResult(result) {
  // Default for a malformed result (a module's run() that omits verdict) so the
  // badge never renders the literal string "undefined".
  const verdict = result.verdict || "exploited";
  const verdictLabel = {
    exploited: "⚠️  Exploited — the attack succeeded",
    blocked: "✓  Blocked — the attack was stopped",
    safe: "✓  Safe — input handled correctly",
    inert: "◐  Inert — markup was injected, but nothing executed",
  }[verdict] || verdict;

  const box = el(`<div class="result"></div>`);
  box.appendChild(
    el(`<span class="verdict ${escapeHtml(verdict)}">${escapeHtml(verdictLabel)}</span>`)
  );

  if (Array.isArray(result.steps) && result.steps.length) {
    const trace = el(`<div class="trace"></div>`);
    for (const step of result.steps) {
      const flagClass = step.flag === "bad" ? "flag-bad" : step.flag === "good" ? "flag-good" : "";
      const row = el(`<div class="trace-row"><div class="k"></div><div class="v ${flagClass}"></div></div>`);
      row.querySelector(".k").textContent = step.label ?? "";
      row.querySelector(".v").textContent = step.value ?? "";
      trace.appendChild(row);
    }
    box.appendChild(trace);
  }

  if (result.demo && result.demo.type === "iframe") {
    const demo = el(`<div class="demo-frame"><div class="demo-label"></div></div>`);
    demo.querySelector(".demo-label").textContent = result.demo.label || "Rendered output";
    const frame = document.createElement("iframe");
    // Sandboxed: no same-origin, no top navigation, no popups. Scripts allowed
    // so XSS-style demos can actually "fire" — but only inside this jail.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.srcdoc = result.demo.srcdoc;
    demo.appendChild(frame);
    box.appendChild(demo);
  }

  if (result.note) {
    const note = el(`<div class="note"></div>`);
    note.textContent = result.note;
    box.appendChild(note);
  }
  return box;
}

/**
 * Build the interactive sandbox panel for a bug. Wires up the input, presets,
 * vulnerable⟷patched toggle, and result rendering. All behaviour comes from
 * the bug's `sandbox` definition.
 */
export function sandboxPanel(sandbox) {
  let patched = false;

  const panel = el(`
    <div class="sandbox">
      <div class="toolbar">
        <div class="toggle" role="group" aria-label="Mode">
          <button type="button" class="vuln on" data-mode="vuln">Vulnerable</button>
          <button type="button" class="safe" data-mode="safe">Patched</button>
        </div>
      </div>
      <label class="field-label" for="payload-input"></label>
      <div class="input-row">
        ${
          sandbox.multiline
            ? '<textarea id="payload-input" class="payload" rows="8" autocomplete="off" spellcheck="false"></textarea>'
            : '<input id="payload-input" class="payload" type="text" autocomplete="off" spellcheck="false" />'
        }
        <button type="button" class="run-btn">Run ▸</button>
      </div>
      <div class="presets"></div>
      <div class="result-host"></div>
    </div>
  `);

  const input = panel.querySelector(".payload");
  const label = panel.querySelector(".field-label");
  const presetHost = panel.querySelector(".presets");
  const resultHost = panel.querySelector(".result-host");
  const [vulnBtn, safeBtn] = panel.querySelectorAll(".toggle button");

  label.textContent = sandbox.inputLabel || "Input";
  input.placeholder = sandbox.placeholder || "";
  if (sandbox.default) input.value = sandbox.default;

  (sandbox.presets || []).forEach((p) => {
    const b = el(`<button type="button" class="preset"></button>`);
    b.textContent = p.label;
    b.title = p.value;
    b.addEventListener("click", () => {
      input.value = p.value;
      run();
    });
    presetHost.appendChild(b);
  });

  function setMode(toPatched) {
    patched = toPatched;
    vulnBtn.classList.toggle("on", !patched);
    safeBtn.classList.toggle("on", patched);
    // Re-run so the result always reflects the active mode. If a result was
    // already shown, re-run it through the other mode; otherwise clear any
    // stale result so it can't contradict the toggle.
    if (resultHost.childElementCount) run();
  }
  vulnBtn.addEventListener("click", () => setMode(false));
  safeBtn.addEventListener("click", () => setMode(true));

  function run() {
    resultHost.innerHTML = "";
    let result;
    try {
      result = sandbox.run(input.value, { patched });
    } catch (err) {
      result = { verdict: "exploited", steps: [{ label: "error", value: String(err) }] };
    }
    resultHost.appendChild(renderResult(result));
  }
  panel.querySelector(".run-btn").addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    // Plain input: Enter runs. Textarea: Enter inserts a newline, Ctrl/Cmd+Enter runs.
    if (e.key === "Enter" && (!sandbox.multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    }
  });

  return panel;
}
