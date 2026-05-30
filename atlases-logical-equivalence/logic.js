/**
 * Shared propositional logic parser and evaluator for Atlases labs.
 */

export const VARIABLES = ["p", "q", "r", "s"];

export const OP_DISPLAY = {
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

export function normalizeInput(input) {
  return input
    .replace(/\s+/g, "")
    .replace(/∧/g, "&")
    .replace(/∨/g, "|")
    .replace(/([pqrs)])v([(~pqrs])/gi, "$1|$2")
    .replace(/([pqrs)])V([(~pqrs])/g, "$1|$2")
    .replace(/\^/g, "&")
    .toLowerCase();
}

export function tokenize(input) {
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

    if (ch === "t") {
      tokens.push({ type: "const", value: true });
      i += 1;
      continue;
    }

    if (ch === "f") {
      tokens.push({ type: "const", value: false });
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

export function parseInput(input) {
  if (!input.trim()) throw new Error("Enter a proposition first.");
  const tokens = tokenize(input);
  if (!tokens.length) throw new Error("Enter a proposition first.");

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
      const right = op === "=>" ? parseExpression(prec) : parseExpression(prec + 1);
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

    if (token.type === "const") {
      consume("const");
      return { type: "const", value: token.value };
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

export function formatNode(node) {
  if (node.type === "var") return node.name;
  if (node.type === "const") return node.value ? "T" : "F";
  if (node.type === "unary") {
    const arg = formatNode(node.arg);
    const needsParens = node.arg.type === "binary";
    return `${OP_DISPLAY[node.op]}${needsParens ? `(${arg})` : arg}`;
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

export function evalNode(node, env) {
  if (node.type === "var") return !!env[node.name];
  if (node.type === "const") return node.value;
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

export function expressionUsesVar(node, name) {
  if (node.type === "const") return false;
  if (node.type === "var") return node.name === name;
  if (node.type === "unary") return expressionUsesVar(node.arg, name);
  if (node.type === "group") return expressionUsesVar(node.inner, name);
  return expressionUsesVar(node.left, name) || expressionUsesVar(node.right, name);
}

export function collectUsedVars(...asts) {
  const used = new Set();
  asts.forEach((ast) => {
    VARIABLES.forEach((name) => {
      if (expressionUsesVar(ast, name)) used.add(name);
    });
  });
  return VARIABLES.filter((name) => used.has(name));
}

export function buildAssignments(usedVars) {
  const rowCount = 2 ** usedVars.length;
  const rows = [];
  for (let i = 0; i < rowCount; i += 1) {
    const env = {};
    usedVars.forEach((name, idx) => {
      const bit = (rowCount - 1 - i) >> (usedVars.length - 1 - idx);
      env[name] = (bit & 1) === 1;
    });
    rows.push(env);
  }
  return rows;
}

export function compareExpressions(exprA, exprB) {
  const astA = parseInput(exprA);
  const astB = parseInput(exprB);
  const usedVars = collectUsedVars(astA, astB);
  const assignments = buildAssignments(usedVars);
  const rows = assignments.map((env) => ({
    env,
    left: evalNode(astA, env),
    right: evalNode(astB, env),
    match: evalNode(astA, env) === evalNode(astB, env),
  }));

  return {
    equivalent: rows.every((row) => row.match),
    usedVars,
    rows,
    leftFormatted: formatNode(astA),
    rightFormatted: formatNode(astB),
  };
}

export function formatDisplay(input) {
  return formatNode(parseInput(input));
}
