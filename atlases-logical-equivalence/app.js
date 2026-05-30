/**
 * Atlases Logical Equivalence Lab
 * Interactive equivalence-chain builder with animated proof steps.
 */

import {
  normalizeInput,
  parseInput,
  formatNode,
  formatDisplay,
  compareExpressions,
} from "./logic.js";

const MAX_SLOTS = 10;

const EXERCISES = [
  {
    id: "ex5",
    type: "Section 1.2",
    label: "Example 5",
    summary: "De Morgan on a nested disjunction",
    target: "~(p v ((~p) & q)) ≡ ~p & ~q",
    steps: [
      { expr: "~(p v ((~p) & q))", law: "Start" },
      { expr: "~p & ~( (~p) & q)", law: "De Morgan's law (outer)" },
      { expr: "~p & (~(~p) v ~q)", law: "De Morgan's law (inner)" },
      { expr: "~p & (p v ~q)", law: "Double negation" },
      { expr: "(~p & p) v (~p & ~q)", law: "Distributivity of ∧ over ∨" },
      { expr: "F v (~p & ~q)", law: "Contradiction (~p ∧ p)" },
      { expr: "~p & ~q", law: "Identity (F ∨ x ≡ x)" },
    ],
  },
  {
    id: "ex6",
    type: "Section 1.2",
    label: "Example 6",
    summary: "Implication from a conjunction",
    target: "(p & q) => (p | q) ≡ T",
    steps: [
      { expr: "(p & q) => (p | q)", law: "Start" },
      { expr: "~(p & q) | (p | q)", law: "Definition of implication" },
      { expr: "(~p | ~q) | (p | q)", law: "De Morgan's law" },
      { expr: "T", law: "Tautology (exhaustive truth table)" },
    ],
  },
  {
    id: "dm1",
    type: "Identity",
    label: "De Morgan (OR)",
    summary: "Negating a disjunction",
    target: "~(p | q) ≡ ~p & ~q",
    steps: [
      { expr: "~(p | q)", law: "Start" },
      { expr: "~p & ~q", law: "De Morgan's law" },
    ],
  },
  {
    id: "dm2",
    type: "Identity",
    label: "De Morgan (AND)",
    summary: "Negating a conjunction",
    target: "~(p & q) ≡ ~p | ~q",
    steps: [
      { expr: "~(p & q)", law: "Start" },
      { expr: "~p | ~q", law: "De Morgan's law" },
    ],
  },
  {
    id: "imp",
    type: "Identity",
    label: "Implication",
    summary: "Conditional as disjunction",
    target: "(p => q) ≡ (~p | q)",
    steps: [
      { expr: "p => q", law: "Start" },
      { expr: "~p | q", law: "Definition of implication" },
    ],
  },
  {
    id: "dn",
    type: "Identity",
    label: "Double negation",
    summary: "Two negations cancel",
    target: "~~p ≡ p",
    steps: [
      { expr: "~~p", law: "Start" },
      { expr: "p", law: "Double negation" },
    ],
  },
  {
    id: "contra",
    type: "Identity",
    label: "Contrapositive",
    summary: "Implication and its contrapositive",
    target: "(p => q) ≡ (~q => ~p)",
    steps: [
      { expr: "p => q", law: "Start" },
      { expr: "~p | q", law: "Definition of implication" },
      { expr: "~~(~p | q)", law: "Double negation" },
      { expr: "~(~(~p | q))", law: "Double negation" },
      { expr: "~(p & ~q)", law: "De Morgan's law" },
      { expr: "~p | ~~q", law: "De Morgan's law" },
      { expr: "~q => ~p", law: "Definition of implication" },
    ],
  },
  {
    id: "abs",
    type: "Identity",
    label: "Absorption",
    summary: "Disjunction absorbs conjunction",
    target: "p | (p & q) ≡ p",
    steps: [
      { expr: "p | (p & q)", law: "Start" },
      { expr: "(p | p) & (p | q)", law: "Distributivity of ∨ over ∧" },
      { expr: "p & (p | q)", law: "Idempotence" },
      { expr: "p", law: "Absorption" },
    ],
  },
];

const state = {
  slots: Array.from({ length: MAX_SLOTS }, () => ""),
  activeSlot: 0,
  activeExerciseId: null,
  proofSteps: null,
  step: 0,
  maxStep: 0,
  playing: false,
  playTimer: null,
  verification: null,
  mode: "build",
};

const els = {
  chainHost: document.getElementById("chainHost"),
  errorBanner: document.getElementById("errorBanner"),
  statusBar: document.getElementById("statusBar"),
  compareHost: document.getElementById("compareHost"),
  lawBanner: document.getElementById("lawBanner"),
  exerciseList: document.getElementById("exerciseList"),
  verifyBtn: document.getElementById("verifyBtn"),
  clearBtn: document.getElementById("clearBtn"),
  backspaceBtn: document.getElementById("backspaceBtn"),
  addSlotBtn: document.getElementById("addSlotBtn"),
  restartBtn: document.getElementById("restartBtn"),
  backBtn: document.getElementById("backBtn"),
  playBtn: document.getElementById("playBtn"),
  nextBtn: document.getElementById("nextBtn"),
  solveBtn: document.getElementById("solveBtn"),
  identitiesLink: document.getElementById("identitiesLink"),
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  if (!message) {
    els.errorBanner.classList.remove("visible");
    els.errorBanner.textContent = "";
    return;
  }
  els.errorBanner.textContent = message;
  els.errorBanner.classList.add("visible");
}

function filledSlotCount() {
  return state.slots.filter((slot) => slot.trim()).length;
}

function visibleSlotCount() {
  if (state.proofSteps) {
    return Math.min(state.proofSteps.length, Math.max(1, state.step));
  }
  let lastFilled = -1;
  state.slots.forEach((slot, idx) => {
    if (slot.trim()) lastFilled = idx;
  });
  return lastFilled + 1 || 1;
}

function getDisplayedSlots() {
  if (state.proofSteps) {
    const count = Math.max(1, state.step);
    return state.proofSteps.slice(0, count).map((step) => step.expr);
  }
  return state.slots;
}

function formatSlot(expr) {
  if (!expr.trim()) return "";
  try {
    return formatDisplay(expr);
  } catch {
    return expr;
  }
}

function stopPlayback() {
  state.playing = false;
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  updatePlaybackControls();
}

function computeMaxStep() {
  if (state.proofSteps) {
    return state.proofSteps.length;
  }
  return Math.max(1, filledSlotCount());
}

function currentLawText() {
  if (!state.proofSteps || state.step <= 0) return "";
  const step = state.proofSteps[state.step - 1];
  return step?.law && step.law !== "Start" ? step.law : "";
}

function verifyAdjacentPairs(slots) {
  const filled = slots.map((s) => s.trim()).filter(Boolean);
  if (filled.length < 2) {
    throw new Error("Enter at least two expressions to verify equivalence.");
  }

  const pairs = [];
  for (let i = 0; i < filled.length - 1; i += 1) {
    pairs.push(compareExpressions(filled[i], filled[i + 1]));
  }

  return {
    pairs,
    allEquivalent: pairs.every((pair) => pair.equivalent),
  };
}

function renderChain() {
  const displayed = getDisplayedSlots();
  const visibleCount = visibleSlotCount();
  const rows = [];

  for (let i = 0; i < MAX_SLOTS; i += 1) {
    const hidden = i >= visibleCount;
    const expr = displayed[i] || "";
    const formatted = formatSlot(expr);
    const isActive = !state.proofSteps && state.activeSlot === i;
    const isRevealed =
      state.proofSteps && state.step > 0 && i === state.step - 1;
    const isEmpty = !expr.trim();

    rows.push(`
      <div class="chain-row ${hidden ? "hidden-row" : ""} ${isRevealed ? "revealed" : ""}" data-slot="${i}">
        <button
          type="button"
          class="expr-slot ${isActive ? "active" : ""} ${isEmpty ? "empty" : ""}"
          data-slot="${i}"
          aria-label="Expression slot ${i + 1}"
        >
          ${
            isEmpty
              ? `<span class="slot-placeholder">Click to enter expression ${i + 1}</span>`
              : `<span class="slot-expr">${escapeHtml(formatted)}</span>`
          }
        </button>
        ${
          i < MAX_SLOTS - 1
            ? `<div class="equiv-mark ${i < visibleCount - 1 ? "visible" : ""}" aria-hidden="true">≡</div>`
            : ""
        }
      </div>`);
  }

  els.chainHost.innerHTML = rows.join("");

  els.chainHost.querySelectorAll(".expr-slot").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.proofSteps) return;
      state.activeSlot = Number(button.dataset.slot);
      renderChain();
    });
  });
}

function renderCompare() {
  const displayed = getDisplayedSlots().map((s) => s.trim()).filter(Boolean);

  if (state.proofSteps && state.step >= 2) {
    const left = displayed[state.step - 2];
    const right = displayed[state.step - 1];
    if (left && right) {
      try {
        const result = compareExpressions(left, right);
        state.verification = { pairs: [result], allEquivalent: result.equivalent };
        renderCompareTable(left, right, result);
        return;
      } catch (err) {
        setError(err.message);
      }
    }
  }

  if (!state.proofSteps && displayed.length >= 2) {
    try {
      state.verification = verifyAdjacentPairs(displayed);
      const lastPair = state.verification.pairs[state.verification.pairs.length - 1];
      const left = displayed[displayed.length - 2];
      const right = displayed[displayed.length - 1];
      renderCompareTable(left, right, lastPair);
      return;
    } catch (err) {
      setError(err.message);
    }
  }

  state.verification = null;
  els.compareHost.innerHTML = `
    <div class="empty-state">
      <p>
        Build an equivalence chain, then press <strong>Verify</strong> to compare adjacent
        expressions side by side. Choose an exercise and press <strong>Play</strong> to animate
        a proof step by step.
      </p>
    </div>`;
}

function renderCompareTable(leftRaw, rightRaw, result) {
  const head = result.usedVars
    .map((name) => `<th>${escapeHtml(name)}</th>`)
    .join("");

  const body = result.rows
    .map((row) => {
      const vars = result.usedVars
        .map((name) => {
          const val = row.env[name];
          return `<td class="var-col">${val ? "T" : "F"}</td>`;
        })
        .join("");
      return `
        <tr class="${row.match ? "match-row" : "mismatch-row"}">
          ${vars}
          <td class="${row.left ? "true" : "false"}">${row.left ? "T" : "F"}</td>
          <td class="${row.right ? "true" : "false"}">${row.right ? "T" : "F"}</td>
          <td class="match-col">${row.match ? "✓" : "✗"}</td>
        </tr>`;
    })
    .join("");

  els.compareHost.innerHTML = `
    <div class="compare-panel">
      <div class="compare-head">
        <div class="compare-expr">
          <span class="compare-label">Left</span>
          <span class="compare-text">${escapeHtml(result.leftFormatted)}</span>
        </div>
        <div class="equiv-badge" aria-hidden="true">≡</div>
        <div class="compare-expr">
          <span class="compare-label">Right</span>
          <span class="compare-text">${escapeHtml(result.rightFormatted)}</span>
        </div>
      </div>
      <table class="truth-table compare-table" aria-label="Equivalence comparison">
        <thead>
          <tr>
            ${head}
            <th>${escapeHtml(result.leftFormatted)}</th>
            <th>${escapeHtml(result.rightFormatted)}</th>
            <th>Match</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderStatus() {
  const law = currentLawText();
  els.lawBanner.hidden = !law;
  els.lawBanner.textContent = law ? `Law applied: ${law}` : "";

  if (state.proofSteps) {
    const exercise = EXERCISES.find((item) => item.id === state.activeExerciseId);
    const atEnd = state.step >= state.maxStep;
    els.statusBar.hidden = false;
    els.statusBar.innerHTML = `
      <span class="status-pill"><strong>${escapeHtml(exercise?.label || "Exercise")}</strong></span>
      <span class="status-pill">Step ${Math.max(1, state.step)} of ${state.maxStep}</span>
      ${
        atEnd
          ? `<span class="status-pill status-ok">Chain verified ✓</span>`
          : `<span class="status-pill">Animating proof…</span>`
      }
      <span class="status-pill">${escapeHtml(exercise?.target || "")}</span>`;
    return;
  }

  if (state.verification) {
    els.statusBar.hidden = false;
    els.statusBar.innerHTML = `
      <span class="status-pill ${
        state.verification.allEquivalent ? "status-ok" : "status-bad"
      }">
        <strong>${
          state.verification.allEquivalent
            ? "Logically equivalent"
            : "Not equivalent"
        }</strong>
      </span>
      <span class="status-pill">${state.verification.pairs.length} pair${
        state.verification.pairs.length === 1 ? "" : "s"
      } checked</span>`;
    return;
  }

  els.statusBar.hidden = true;
}

function updatePlaybackControls() {
  const hasProof = !!state.proofSteps;
  const hasContent = filledSlotCount() > 0 || hasProof;
  const atStart = state.step <= (hasProof ? 1 : 0);
  const atEnd = state.step >= state.maxStep;

  els.restartBtn.disabled = !hasContent || atStart;
  els.backBtn.disabled = !hasContent || atStart;
  els.playBtn.disabled = !hasProof && filledSlotCount() < 2;
  els.nextBtn.disabled = !hasContent || atEnd;
  els.solveBtn.disabled = !hasProof || atEnd;

  els.playBtn.innerHTML = state.playing
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  els.playBtn.title = state.playing ? "Pause" : "Play";
}

function renderAll() {
  renderChain();
  renderCompare();
  renderStatus();
  updatePlaybackControls();
}

function setStep(step) {
  state.step = Math.max(state.proofSteps ? 1 : 0, Math.min(step, state.maxStep));
  renderAll();
}

function insertSymbol(symbol) {
  if (state.proofSteps) return;
  stopPlayback();
  state.activeExerciseId = null;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });

  const normalized = normalizeInput(symbol);
  state.slots[state.activeSlot] += normalized;
  state.verification = null;
  setError("");
  renderAll();
}

function backspaceSymbol() {
  if (state.proofSteps) return;
  const current = state.slots[state.activeSlot];
  if (!current) return;

  stopPlayback();
  state.activeExerciseId = null;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });

  const normalized = normalizeInput(current);
  let trimmed = normalized.slice(0, -1);
  if (normalized.endsWith("<=>")) trimmed = normalized.slice(0, -3);
  else if (normalized.endsWith("=>") || normalized.endsWith("xor")) trimmed = normalized.slice(0, -3);
  else if (normalized.endsWith("nand")) trimmed = normalized.slice(0, -4);
  else if (normalized.endsWith("nor")) trimmed = normalized.slice(0, -3);

  state.slots[state.activeSlot] = trimmed;
  state.verification = null;
  renderAll();
}

function clearChain() {
  stopPlayback();
  state.slots = Array.from({ length: MAX_SLOTS }, () => "");
  state.activeSlot = 0;
  state.activeExerciseId = null;
  state.proofSteps = null;
  state.step = 0;
  state.maxStep = 0;
  state.verification = null;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });
  setError("");
  renderAll();
}

function verifyChain() {
  stopPlayback();
  state.proofSteps = null;
  state.step = 0;
  state.maxStep = computeMaxStep();

  try {
    state.verification = verifyAdjacentPairs(state.slots);
    setError("");
  } catch (err) {
    state.verification = null;
    setError(err.message);
  }
  renderAll();
}

function loadExercise(exercise) {
  stopPlayback();
  state.activeExerciseId = exercise.id;
  state.proofSteps = exercise.steps;
  state.slots = Array.from({ length: MAX_SLOTS }, (_, idx) => exercise.steps[idx]?.expr || "");
  state.step = 1;
  state.maxStep = exercise.steps.length;
  state.verification = null;
  setError("");
  renderAll();
}

function togglePlay() {
  if (!state.proofSteps) {
    if (filledSlotCount() < 2) return;
    verifyChain();
    return;
  }

  if (state.playing) {
    stopPlayback();
    return;
  }

  if (state.step >= state.maxStep) {
    state.step = 1;
    renderAll();
  }

  state.playing = true;
  updatePlaybackControls();
  state.playTimer = setInterval(() => {
    if (state.step >= state.maxStep) {
      stopPlayback();
      return;
    }
    state.step += 1;
    renderAll();
  }, 900);
}

function renderExercises() {
  els.exerciseList.innerHTML = EXERCISES.map(
    (exercise) => `
      <button type="button" class="exercise-card" data-id="${exercise.id}">
        <div class="exercise-type">${escapeHtml(exercise.type)} · ${escapeHtml(exercise.label)}</div>
        <div class="exercise-label">${escapeHtml(exercise.summary)}</div>
        <div class="exercise-expr">${escapeHtml(exercise.target)}</div>
      </button>`,
  ).join("");

  els.exerciseList.querySelectorAll(".exercise-card").forEach((button) => {
    button.addEventListener("click", () => {
      els.exerciseList.querySelectorAll(".exercise-card").forEach((el) => {
        el.classList.toggle("active", el === button);
      });
      const exercise = EXERCISES.find((item) => item.id === button.dataset.id);
      if (exercise) loadExercise(exercise);
    });
  });
}

function bindEvents() {
  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      insertSymbol(button.dataset.insert);
    });
  });

  els.verifyBtn.addEventListener("click", verifyChain);
  els.clearBtn.addEventListener("click", clearChain);
  els.backspaceBtn.addEventListener("click", backspaceSymbol);

  els.addSlotBtn.addEventListener("click", () => {
    if (state.proofSteps) return;
    const next = Math.min(state.activeSlot + 1, MAX_SLOTS - 1);
    state.activeSlot = next;
    renderAll();
  });

  els.restartBtn.addEventListener("click", () => {
    stopPlayback();
    setStep(state.proofSteps ? 1 : 0);
  });

  els.backBtn.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step - 1);
  });

  els.nextBtn.addEventListener("click", () => {
    stopPlayback();
    setStep(state.step + 1);
  });

  els.playBtn.addEventListener("click", togglePlay);
  els.solveBtn.addEventListener("click", () => {
    stopPlayback();
    if (state.proofSteps) {
      state.step = state.maxStep;
      renderAll();
    } else {
      verifyChain();
    }
  });

  els.identitiesLink.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("identitiesPanel").hidden = false;
  });

  document.getElementById("closeIdentities").addEventListener("click", () => {
    document.getElementById("identitiesPanel").hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && document.activeElement === document.body) {
      event.preventDefault();
      backspaceSymbol();
    }
    if (event.key === "Enter") {
      verifyChain();
    }
    if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    }
  });
}

renderExercises();
bindEvents();
renderAll();
