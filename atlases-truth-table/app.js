/**
 * Atlases Truth Table Lab
 * Interactive truth table builder with animated step-by-step reveal.
 */

const VARIABLES = ["p", "q", "r", "s"];

const EXERCISES = [
  {
    id: "t1",
    type: "Tautology",
    label: "Excluded middle",
    expr: "p v ~p",
    display: "p ∨ ¬p",
  },
  {
    id: "t2",
    type: "Tautology",
    label: "Modus ponens",
    expr: "(p & (p => q)) => q",
    display: "(p ∧ (p → q)) → q",
  },
  {
    id: "t3",
    type: "Tautology",
    label: "Contrapositive",
    expr: "(p => q) => (~q => ~p)",
    display: "(p → q) → (¬q → ¬p)",
  },
  {
    id: "c1",
    type: "Contingency",
    label: "Simple implication",
    expr: "p => q",
    display: "p → q",
  },
  {
    id: "c2",
    type: "Contingency",
    label: "Exclusive or",
    expr: "p xor q",
    display: "p ⊕ q",
  },
  {
    id: "c3",
    type: "Contingency",
    label: "Biconditional",
    expr: "p <=> q",
    display: "p ↔ q",
  },
  {
    id: "x1",
    type: "Contradiction",
    label: "Direct contradiction",
    expr: "p & ~p",
    display: "p ∧ ¬p",
  },
  {
    id: "x2",
    type: "Contradiction",
    label: "Both imply false",
    expr: "(p => q) & (p & ~q)",
    display: "(p → q) ∧ (p ∧ ¬q)",
  },
  {
    id: "x3",
    type: "Contradiction",
    label: "Nor of opposites",
    expr: "p nor ~p",
    display: "p NOR ¬p",
  },
];

const OP_DISPLAY = {
  "~": "¬",
  "&": "∧",
  "|": "∨",
  nand: "↑",
  nor: "↓",
  "=>": "→",
  "<=>": "↔",
  xor: "⊕",
};

const PRECEDENCE = {
  "<=>": 1,
  "=>": 2,
  xor: 3,
  "|": 4,
  nor: 5,
  "&": 6,
  nand: 6,
};

const state = {
  rawExpr: "",
  displayExpr: "",
  activeExerciseId: null,
  table: null,
  revealMode: "column",
  step: 0,
  maxStep: 0,
  playing: false,
  playTimer: null,
};

const els = {
  expressionBox: document.getElementById("expressionBox"),
  errorBanner: document.getElementById("errorBanner"),
  statusBar: document.getElementById("statusBar"),
  tableHost: document.getElementById("tableHost"),
  exerciseList: document.getElementById("exerciseList"),
  displayBtn: document.getElementById("displayBtn"),
  clearBtn: document.getElementById("clearBtn"),
  showAllBtn: document.getElementById("showAllBtn"),
  backspaceBtn: document.getElementById("backspaceBtn"),
  restartBtn: document.getElementById("restartBtn"),
  backBtn: document.getElementById("backBtn"),
  playBtn: document.getElementById("playBtn"),
  nextBtn: document.getElementById("nextBtn"),
  solveBtn: document.getElementById("solveBtn"),
  modeColumn: document.getElementById("modeColumn"),
  modeRow: document.getElementById("modeRow"),
};

function normalizeInput(input) {
  return input
    .replace(/\s+/g, "")
    .replace(/∧/g, "&")
    .replace(/∨/g, "|")
    .replace(/v/g, "|")
    .replace(/V/g, "|")
    .toLowerCase();
}

function tokenize(input) {
  const src = normalizeInput(input);
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if ("pqrs".includes(ch)) {
      tokens.push({ type: "var", value: ch });
      i += 1;
      continue;
    }

    if (ch === "~") {
      tokens.push({ type: "op", value: "~" });
      i += 1;
      continue;
    }

    if (ch === "&") {
      tokens.push({ type: "op", value: "&" });
      i += 1;
      continue;
    }

    if (ch === "|") {
      tokens.push({ type: "op", value: "|" });
      i += 1;
      continue;
    }

    if (src.slice(i, i + 2) === "=>") {
      tokens.push({ type: "op", value: "=>" });
      i += 2;
      continue;
    }

    if (src.slice(i, i + 3) === "<=>") {
      tokens.push({ type: "op", value: "<=>" });
      i += 3;
      continue;
    }

    if (src.slice(i, i + 4) === "nand") {
      tokens.push({ type: "op", value: "nand" });
      i += 4;
      continue;
    }

    if (src.slice(i, i + 3) === "nor") {
      tokens.push({ type: "op", value: "nor" });
      i += 3;
      continue;
    }

    if (src.slice(i, i + 3) === "xor") {
      tokens.push({ type: "op", value: "xor" });
      i += 3;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at position ${i + 1}.`);
  }

  return tokens;
}

function parseTokens(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume(expectedType, expectedValue) {
    const token = tokens[pos];
    if (!token) throw new Error("Unexpected end of expression.");
    if (token.type !== expectedType) {
      throw new Error(`Expected ${expectedType}, found ${token.type}.`);
    }
    if (expectedValue !== undefined && token.value !== expectedValue) {
      throw new Error(`Expected operator ${expectedValue}.`);
    }
    pos += 1;
    return token;
  }

  function parseExpression(minPrec = 0) {
    let left = parseUnary();

    while (true) {
      const token = peek();
      if (!token || token.type !== "op" || token.value === "~") break;
      const op = token.value;
      const prec = PRECEDENCE[op];
      if (prec < minPrec) break;
      consume("op", op);
      const right =
        op === "=>"
          ? parseExpression(prec)
          : parseExpression(prec + 1);
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  function parseUnary() {
    if (peek()?.type === "op" && peek().value === "~") {
      consume("op", "~");
      return { type: "unary", op: "~", arg: parseUnary() };
    }

    const token = peek();
    if (!token) throw new Error("Unexpected end of expression.");

    if (token.type === "var") {
      consume("var");
      return { type: "var", name: token.value };
    }

    if (token.type === "lparen") {
      consume("lparen");
      const inner = parseExpression(0);
      consume("rparen");
      return { type: "group", inner };
    }

    throw new Error(`Unexpected token ${token.type}.`);
  }

  const ast = parseExpression(0);
  if (pos < tokens.length) {
    throw new Error("Extra tokens after expression.");
  }
  return ast;
}

function parseInput(input) {
  if (!input.trim()) throw new Error("Enter a proposition first.");
  const tokens = tokenize(input);
  if (!tokens.length) throw new Error("Enter a proposition first.");
  return parseTokens(tokens);
}

function formatNode(node) {
  if (node.type === "var") return node.name;
  if (node.type === "unary") {
    return `${OP_DISPLAY[node.op]}${formatNode(node.arg)}`;
  }
  if (node.type === "group") {
    return `(${formatNode(node.inner)})`;
  }
  if (node.type === "binary") {
    const left =
      node.left.type === "binary" && PRECEDENCE[node.left.op] < PRECEDENCE[node.op]
        ? `(${formatNode(node.left)})`
        : formatNode(node.left);
    const right =
      node.right.type === "binary" && PRECEDENCE[node.right.op] <= PRECEDENCE[node.op]
        ? `(${formatNode(node.right)})`
        : formatNode(node.right);
    return `${left} ${OP_DISPLAY[node.op]} ${right}`;
  }
  return "";
}

function evalNode(node, env) {
  if (node.type === "var") return !!env[node.name];
  if (node.type === "unary") return !evalNode(node.arg, env);
  if (node.type === "group") return evalNode(node.inner, env);

  const a = evalNode(node.left, env);
  const b = evalNode(node.right, env);

  switch (node.op) {
    case "&":
      return a && b;
    case "nand":
      return !(a && b);
    case "|":
      return a || b;
    case "nor":
      return !(a || b);
    case "=>":
      return !a || b;
    case "<=>":
      return a === b;
    case "xor":
      return a !== b;
    default:
      throw new Error(`Unknown operator ${node.op}`);
  }
}

function collectColumns(ast) {
  const columns = [];
  const seen = new Set();

  VARIABLES.forEach((name) => {
    if (!expressionUsesVar(ast, name)) return;
    const key = `var:${name}`;
    seen.add(key);
    columns.push({
      kind: "var",
      key,
      label: name,
      eval: (env) => !!env[name],
    });
  });

  function addSub(node, isFinal = false) {
    const label = formatNode(node);
    const key = `sub:${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    columns.push({
      kind: isFinal ? "final" : "sub",
      key,
      label,
      eval: (env) => evalNode(node, env),
    });
  }

  function walk(node) {
    if (node.type === "var") return;

    if (node.type === "unary") {
      walk(node.arg);
      addSub(node);
      return;
    }

    if (node.type === "group") {
      walk(node.inner);
      return;
    }

    walk(node.left);
    walk(node.right);
    addSub(node, node === ast);
  }

  walk(ast);
  return columns;
}

function expressionUsesVar(node, name) {
  if (node.type === "var") return node.name === name;
  if (node.type === "unary") return expressionUsesVar(node.arg, name);
  if (node.type === "group") return expressionUsesVar(node.inner, name);
  return expressionUsesVar(node.left, name) || expressionUsesVar(node.right, name);
}

function buildTruthTable(ast) {
  const columns = collectColumns(ast);
  const usedVars = VARIABLES.filter((v) => expressionUsesVar(ast, v));
  const rowCount = 2 ** usedVars.length;
  const rows = [];

  for (let i = 0; i < rowCount; i += 1) {
    const env = {};
    usedVars.forEach((name, idx) => {
      const bit = (rowCount - 1 - i) >> (usedVars.length - 1 - idx);
      env[name] = (bit & 1) === 1;
    });
    rows.push(columns.map((col) => col.eval(env)));
  }

  const finalCol = columns.length - 1;
  const finalValues = rows.map((row) => row[finalCol]);
  const allTrue = finalValues.every(Boolean);
  const allFalse = finalValues.every((v) => !v);
  const classification = allTrue
    ? "Tautology"
    : allFalse
      ? "Contradiction"
      : "Contingency";

  return {
    ast,
    columns,
    rows,
    usedVars,
    classification,
    formatted: formatNode(ast),
  };
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

function updateExpressionView() {
  if (!state.rawExpr) {
    els.expressionBox.classList.add("empty");
    els.expressionBox.textContent =
      "Click symbols to build a proposition, or choose an exercise.";
    return;
  }

  els.expressionBox.classList.remove("empty");
  try {
    const ast = parseInput(state.rawExpr);
    els.expressionBox.textContent = formatNode(ast);
    setError("");
  } catch (err) {
    els.expressionBox.textContent = state.displayExpr || state.rawExpr;
    setError(err.message);
  }
}

function computeMaxStep(table) {
  if (state.revealMode === "column") {
    return table.columns.length;
  }
  return table.rows.length;
}

function isCellVisible(rowIndex, colIndex) {
  if (!state.table) return false;
  if (state.step >= state.maxStep) return true;

  if (state.revealMode === "column") {
    return colIndex < state.step;
  }
  return rowIndex < state.step;
}

function renderTable() {
  if (!state.table) {
    els.statusBar.hidden = true;
    els.tableHost.innerHTML = `
      <div class="empty-state">
        <p>Build a compound proposition and click <strong>Display</strong>, or pick an exercise from the right panel.</p>
      </div>`;
    updatePlaybackControls();
    return;
  }

  const { columns, rows, classification, formatted, usedVars } = state.table;
  els.statusBar.hidden = false;
  els.statusBar.innerHTML = `
    <span class="status-pill"><strong>${classification}</strong></span>
    <span class="status-pill">${usedVars.length} variable${usedVars.length === 1 ? "" : "s"} · ${rows.length} rows</span>
    <span class="status-pill">${formatted}</span>
  `;

  const highlightCol =
    state.revealMode === "column" && state.step > 0 && state.step <= columns.length
      ? state.step - 1
      : -1;
  const highlightRow =
    state.revealMode === "row" && state.step > 0 && state.step <= rows.length
      ? state.step - 1
      : -1;

  const head = columns
    .map(
      (col, idx) =>
        `<th class="${idx === highlightCol ? "highlight" : ""}">${escapeHtml(col.label)}</th>`,
    )
    .join("");

  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const visible = isCellVisible(rowIndex, colIndex);
          const classes = [];
          if (colIndex === highlightCol || rowIndex === highlightRow) {
            classes.push("highlight");
          }
          if (columns[colIndex].kind === "var") classes.push("var-col");
          if (!visible) {
            classes.push("hidden");
          } else {
            classes.push(value ? "true" : "false");
            if (
              (state.revealMode === "column" && colIndex === state.step - 1) ||
              (state.revealMode === "row" && rowIndex === state.step - 1)
            ) {
              classes.push("reveal");
            }
          }
          const text = visible ? (value ? "T" : "F") : "";
          return `<td class="${classes.join(" ")}">${text}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  els.tableHost.innerHTML = `
    <table class="truth-table" aria-label="Truth table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;

  updatePlaybackControls();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updatePlaybackControls() {
  const hasTable = !!state.table;
  const atStart = state.step === 0;
  const atEnd = state.step >= state.maxStep;

  els.restartBtn.disabled = !hasTable || atStart;
  els.backBtn.disabled = !hasTable || atStart;
  els.playBtn.disabled = !hasTable || atEnd;
  els.nextBtn.disabled = !hasTable || atEnd;
  els.solveBtn.disabled = !hasTable || atEnd;

  els.playBtn.innerHTML = state.playing
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  els.playBtn.title = state.playing ? "Pause" : "Play";
}

function stopPlayback() {
  state.playing = false;
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  updatePlaybackControls();
}

function setStep(step) {
  state.step = Math.max(0, Math.min(step, state.maxStep));
  renderTable();
}

function displayTable() {
  stopPlayback();
  try {
    const ast = parseInput(state.rawExpr);
    state.table = buildTruthTable(ast);
    state.step = 0;
    state.maxStep = computeMaxStep(state.table);
    setError("");
    renderTable();
  } catch (err) {
    state.table = null;
    setError(err.message);
    renderTable();
  }
}

function showAll() {
  stopPlayback();
  if (!state.table) {
    displayTable();
  }
  if (state.table) {
    state.step = state.maxStep;
    renderTable();
  }
}

function clearExpression() {
  stopPlayback();
  state.rawExpr = "";
  state.displayExpr = "";
  state.activeExerciseId = null;
  state.table = null;
  state.step = 0;
  state.maxStep = 0;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });
  setError("");
  updateExpressionView();
  renderTable();
}

function insertSymbol(symbol) {
  stopPlayback();
  state.activeExerciseId = null;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });

  const normalized = normalizeInput(symbol);
  state.rawExpr += normalized;
  state.displayExpr += symbol;
  if (state.table) {
    state.table = null;
    state.step = 0;
    state.maxStep = 0;
  }
  updateExpressionView();
  renderTable();
}

function backspaceSymbol() {
  if (!state.rawExpr) return;
  stopPlayback();
  state.activeExerciseId = null;
  document.querySelectorAll(".exercise-card.active").forEach((el) => {
    el.classList.remove("active");
  });

  const normalized = normalizeInput(state.rawExpr);
  let next = normalized.slice(0, -1);
  if (normalized.endsWith("<=>")) next = normalized.slice(0, -3);
  else if (normalized.endsWith("nand")) next = normalized.slice(0, -4);
  else if (normalized.endsWith("=>")) next = normalized.slice(0, -2);
  else if (normalized.endsWith("nor")) next = normalized.slice(0, -3);
  else if (normalized.endsWith("xor")) next = normalized.slice(0, -3);

  state.rawExpr = next;
  state.displayExpr = "";
  state.table = null;
  state.step = 0;
  state.maxStep = 0;
  updateExpressionView();
  renderTable();
}

function loadExercise(exercise) {
  stopPlayback();
  state.activeExerciseId = exercise.id;
  state.rawExpr = exercise.expr;
  state.displayExpr = exercise.display;
  updateExpressionView();
  displayTable();
}

function renderExercises() {
  els.exerciseList.innerHTML = EXERCISES.map(
    (exercise) => `
      <button type="button" class="exercise-card" data-id="${exercise.id}">
        <div class="exercise-type">${escapeHtml(exercise.type)}</div>
        <div class="exercise-label">${escapeHtml(exercise.label)}</div>
        <div class="exercise-expr">${escapeHtml(exercise.display)}</div>
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

function togglePlay() {
  if (!state.table) return;
  if (state.playing) {
    stopPlayback();
    return;
  }
  if (state.step >= state.maxStep) {
    state.step = 0;
    renderTable();
  }
  state.playing = true;
  updatePlaybackControls();
  state.playTimer = setInterval(() => {
    if (state.step >= state.maxStep) {
      stopPlayback();
      return;
    }
    state.step += 1;
    renderTable();
  }, 650);
}

function bindEvents() {
  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      insertSymbol(button.dataset.insert);
    });
  });

  els.displayBtn.addEventListener("click", displayTable);
  els.clearBtn.addEventListener("click", clearExpression);
  els.showAllBtn.addEventListener("click", showAll);
  els.backspaceBtn.addEventListener("click", backspaceSymbol);

  els.restartBtn.addEventListener("click", () => {
    stopPlayback();
    setStep(0);
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
  els.solveBtn.addEventListener("click", showAll);

  els.modeColumn.addEventListener("click", () => {
    if (state.revealMode === "column") return;
    stopPlayback();
    state.revealMode = "column";
    els.modeColumn.classList.add("active");
    els.modeRow.classList.remove("active");
    if (state.table) {
      state.maxStep = computeMaxStep(state.table);
      state.step = Math.min(state.step, state.maxStep);
      renderTable();
    }
  });

  els.modeRow.addEventListener("click", () => {
    if (state.revealMode === "row") return;
    stopPlayback();
    state.revealMode = "row";
    els.modeRow.classList.add("active");
    els.modeColumn.classList.remove("active");
    if (state.table) {
      state.maxStep = computeMaxStep(state.table);
      state.step = Math.min(state.step, state.maxStep);
      renderTable();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && document.activeElement === document.body) {
      event.preventDefault();
      backspaceSymbol();
    }
    if (event.key === "Enter") {
      displayTable();
    }
    if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    }
  });
}

renderExercises();
bindEvents();
renderTable();
