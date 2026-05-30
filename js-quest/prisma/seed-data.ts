/** Curriculum aligned with javascript.info structure (links only; text is original). */

export type SeedLesson = {
  slug: string;
  title: string;
  part: number;
  chapter: string;
  order: number;
  officialUrl: string;
  summary: string;
  questions: {
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  }[];
};

export const seedLessons: SeedLesson[] = [
  {
    slug: "intro",
    title: "An Introduction to JavaScript",
    part: 1,
    chapter: "An introduction",
    order: 1,
    officialUrl: "https://javascript.info/intro",
    summary:
      "JavaScript was created for browsers and now runs everywhere. It follows the ECMAScript standard and pairs with environments like the browser DOM or Node.js.",
    questions: [
      {
        prompt: "Which specification standardizes the JavaScript language core?",
        choices: ["ECMAScript", "ASCII", "OpenGL", "HTML"],
        correctIndex: 0,
        explanation:
          "ECMAScript defines the language; engines implement it in browsers and other runtimes.",
      },
    ],
  },
  {
    slug: "manuals-specifications",
    title: "Manuals and specifications",
    part: 1,
    chapter: "An introduction",
    order: 2,
    officialUrl: "https://javascript.info/manuals-specifications",
    summary:
      "Use official specs for precision (ECMA), MDN for readable reference, and TC39 proposals for upcoming syntax.",
    questions: [
      {
        prompt: "MDN is best described as:",
        choices: [
          "A friendly, maintained reference for web platform APIs and JS",
          "The bytecode format for V8",
          "A CSS-only preprocessor",
          "A React-specific compiler",
        ],
        correctIndex: 0,
        explanation:
          "MDN complements the formal ECMAScript spec with practical docs for developers.",
      },
    ],
  },
  {
    slug: "code-editors",
    title: "Code editors",
    part: 1,
    chapter: "An introduction",
    order: 3,
    officialUrl: "https://javascript.info/code-editors",
    summary:
      "IDEs add linting, debugging, and refactoring. Lightweight editors plus plugins are enough for many JS workflows.",
    questions: [
      {
        prompt: "An LSP-style editor feature for renaming symbols across files is most associated with:",
        choices: ["Refactoring support in a code editor", "A database index", "A CSS reset", "HTTP caching"],
        correctIndex: 0,
        explanation:
          "Rich editors use language services to refactor safely across a project.",
      },
    ],
  },
  {
    slug: "devtools",
    title: "Developer console",
    part: 1,
    chapter: "An introduction",
    order: 4,
    officialUrl: "https://javascript.info/devtools",
    summary:
      "Browser devtools expose console, network, sources, and breakpoints. The console can run short JS snippets for quick checks.",
    questions: [
      {
        prompt: "In a browser, where do you typically set a breakpoint on a line of JavaScript?",
        choices: ["Sources / Debugger panel", "Cookies panel only", "Lighthouse report only", "Print stylesheet"],
        correctIndex: 0,
        explanation:
          "Breakpoints live with source files in the debugger panel of devtools.",
      },
    ],
  },
  {
    slug: "hello-world",
    title: "Hello, world!",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 10,
    officialUrl: "https://javascript.info/hello-world",
    summary:
      "Scripts run in HTML via <script>, can defer loading, and may live in external files for caching and separation of concerns.",
    questions: [
      {
        prompt: "Which attribute tells the browser to fetch a script without blocking HTML parsing until execution time?",
        choices: ["defer", "async=off", "inline-only", "charset=halt"],
        correctIndex: 0,
        explanation:
          "`defer` preserves order and runs after HTML is parsed; `async` fetches in parallel but runs as soon as ready.",
      },
    ],
  },
  {
    slug: "structure",
    title: "Code structure",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 11,
    officialUrl: "https://javascript.info/structure",
    summary:
      "Statements end with semicolons (often automatic via ASI). Use blocks with `{ }` and keep readability with consistent formatting.",
    questions: [
      {
        prompt: "ASI refers to:",
        choices: [
          "Rules that can insert semicolons at line breaks in some cases",
          "A kind of WebAssembly import",
          "Strict mode in TypeScript",
          "A CSS layout algorithm",
        ],
        correctIndex: 0,
        explanation:
          "Automatic Semicolon Insertion can surprise you at line breaks, so many teams prefer explicit semicolons or patterns that avoid pitfalls.",
      },
    ],
  },
  {
    slug: "strict-mode",
    title: 'The modern mode, "use strict"',
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 12,
    officialUrl: "https://javascript.info/strict-mode",
    summary:
      "`\"use strict\"` opts into stricter parsing and runtime checks, catching more mistakes and disabling some legacy behaviors.",
    questions: [
      {
        prompt: "Placing `\"use strict\"` at the top of a script file affects:",
        choices: [
          "The whole script file (when at the top)",
          "Only functions defined before it",
          "Only strings in the file",
          "Only console output",
        ],
        correctIndex: 0,
        explanation:
          "A top-level directive applies to the entire script; you can also scope strictness per function.",
      },
    ],
  },
  {
    slug: "variables",
    title: "Variables",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 13,
    officialUrl: "https://javascript.info/variables",
    summary:
      "`let` and `const` are block-scoped; `const` binds a name but may still allow mutating object innards. Avoid `var` in new code.",
    questions: [
      {
        prompt: "Which declaration is usually preferred for a value that will not be reassigned?",
        choices: ["const", "var", "function", "with"],
        correctIndex: 0,
        explanation:
          "`const` prevents rebinding the identifier; object mutation is a separate concern from reassignment.",
      },
    ],
  },
  {
    slug: "types",
    title: "Data types",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 14,
    officialUrl: "https://javascript.info/types",
    summary:
      "Primitives include number, bigint, string, boolean, null, undefined, and symbol. Everything else is an object (including arrays and functions).",
    questions: [
      {
        prompt: "`typeof null` in JavaScript evaluates to:",
        choices: ['"object"', '"null"', '"undefined"', '"boolean"'],
        correctIndex: 0,
        explanation:
          "This is a long-standing language quirk; use `=== null` to test for null.",
      },
    ],
  },
  {
    slug: "alert-prompt-confirm",
    title: "Interaction: alert, prompt, confirm",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 15,
    officialUrl: "https://javascript.info/alert-prompt-confirm",
    summary:
      "These browser UI helpers block the main thread and are poor UX for production but fine for tiny demos.",
    questions: [
      {
        prompt: "In production sites, modal dialogs like `alert` are often avoided mainly because:",
        choices: [
          "They block script execution and feel disruptive to users",
          "They only work on servers",
          "They require Python",
          "They cannot display numbers",
        ],
        correctIndex: 0,
        explanation:
          "Blocking dialogs harm UX; use in-page UI components instead for real apps.",
      },
    ],
  },
  {
    slug: "type-conversions",
    title: "Type Conversions",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 16,
    officialUrl: "https://javascript.info/type-conversions",
    summary:
      "Explicit coercion uses `String()`, `Number()`, `Boolean()`. Implicit coercion happens in operations like `+` with mixed types.",
    questions: [
      {
        prompt: 'What is the result of `Number("")`?',
        choices: ["0", "NaN", "undefined", "null"],
        correctIndex: 0,
        explanation:
          "Empty string converts to 0; whitespace-only strings also become 0 via `Number`.",
      },
    ],
  },
  {
    slug: "operators",
    title: "Basic operators, maths",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 17,
    officialUrl: "https://javascript.info/operators",
    summary:
      "Arithmetic, remainder `%`, exponent `**`, assignment shortcuts, increment `--/++` with prefix/postfix nuances.",
    questions: [
      {
        prompt: "In JavaScript, the remainder operator is written as:",
        choices: ["%", "mod", "REM", "//"],
        correctIndex: 0,
        explanation: "`%` returns the remainder of division, including sign quirks with negatives.",
      },
    ],
  },
  {
    slug: "comparison",
    title: "Comparisons",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 18,
    officialUrl: "https://javascript.info/comparison",
    summary:
      "Prefer strict `===` / `!==` to avoid coercion. String comparison is lexicographic. `null == undefined` is true but not with `===`.",
    questions: [
      {
        prompt: "Which pair is recommended for most equality checks?",
        choices: ["=== and !==", "== and !=", "= and <>", "eq and neq"],
        correctIndex: 0,
        explanation:
          "Strict equality avoids surprising type coercions from abstract equality.",
      },
    ],
  },
  {
    slug: "ifelse",
    title: "Conditional branching: if, '?'",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 19,
    officialUrl: "https://javascript.info/ifelse",
    summary:
      "`if`, `else if`, and ternary `cond ? a : b` route control flow. Ternaries nest poorly—use `if` for clarity.",
    questions: [
      {
        prompt: "The ternary operator uses which basic shape?",
        choices: ["condition ? exprIfTrue : exprIfFalse", "if condition then", "when / otherwise", "??: alternative"],
        correctIndex: 0,
        explanation:
          "It is a single expression and must return values from both branches.",
      },
    ],
  },
  {
    slug: "logical-operators",
    title: "Logical operators",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 20,
    officialUrl: "https://javascript.info/logical-operators",
    summary:
      "`||`, `&&`, and `!` combine truthiness; they can short-circuit and return operand values, not only booleans.",
    questions: [
      {
        prompt: "`0 || \"hi\"` evaluates to:",
        choices: ['"hi"', "0", "true", "false"],
        correctIndex: 0,
        explanation: "`||` returns the first truthy operand; 0 is falsy, so it returns `\"hi\"`.",
      },
    ],
  },
  {
    slug: "nullish-coalescing-operator",
    title: "Nullish coalescing operator '??'",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 21,
    officialUrl: "https://javascript.info/nullish-coalescing-operator",
    summary:
      "`a ?? b` chooses `b` only when `a` is `null` or `undefined`, unlike `||` which treats many falsy values as missing.",
    questions: [
      {
        prompt: "`0 ?? 100` evaluates to:",
        choices: ["0", "100", "null", "undefined"],
        correctIndex: 0,
        explanation:
          "Nullish coalescing ignores only `null`/`undefined`, so `0` is preserved.",
      },
    ],
  },
  {
    slug: "while-for",
    title: "Loops: while and for",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 22,
    officialUrl: "https://javascript.info/while-for",
    summary:
      "`while`, `do..while`, `for`, `for..of`, and `for..in` serve different iteration needs; `break`/`continue` adjust flow.",
    questions: [
      {
        prompt: "Which loop checks its condition after the first iteration?",
        choices: ["do...while", "for...of only", "while only", "for (;) never"],
        correctIndex: 0,
        explanation:
          "`do...while` runs the body once before evaluating the condition.",
      },
    ],
  },
  {
    slug: "switch",
    title: 'The "switch" statement',
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 23,
    officialUrl: "https://javascript.info/switch",
    summary:
      "`switch` compares with strict equality. Fall-through requires explicit `break` (or `return`) unless intentional.",
    questions: [
      {
        prompt: "Without `break`, after a matching `case` in `switch`, execution typically:",
        choices: [
          "Falls through to later cases",
          "Stops immediately always",
          "Throws ReferenceError",
          "Rewinds to the top",
        ],
        correctIndex: 0,
        explanation:
          "Fall-through can be useful but is a common source of bugs—use `break` intentionally.",
      },
    ],
  },
  {
    slug: "function-basics",
    title: "Functions",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 24,
    officialUrl: "https://javascript.info/function-basics",
    summary:
      "Functions accept parameters, return values, and create an inner scope. Parameters default to `undefined` if omitted.",
    questions: [
      {
        prompt: "Calling a JS function with fewer arguments than parameters leaves extra parameters as:",
        choices: ["undefined (unless defaulted elsewhere)", "null always", "0 always", "syntax error"],
        correctIndex: 0,
        explanation:
          "Missing arguments are `undefined`; default parameters can change that behavior.",
      },
    ],
  },
  {
    slug: "function-expressions",
    title: "Function expressions",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 25,
    officialUrl: "https://javascript.info/function-expressions",
    summary:
      "Functions are values. Function expressions can be anonymous or named (helpful for stack traces). Hoisting rules differ from declarations.",
    questions: [
      {
        prompt: "A `function` declaration is hoisted as a whole; a `const foo = function() {}` is not usable:",
        choices: [
          "Before that `const` line runs at runtime",
          "Anywhere in the file",
          "Only in strict mode files",
          "Never",
        ],
        correctIndex: 0,
        explanation:
          "`const`/`let` bindings live in the temporal dead zone until initialized.",
      },
    ],
  },
  {
    slug: "arrow-functions-basics",
    title: "Arrow functions, the basics",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 26,
    officialUrl: "https://javascript.info/arrow-functions-basics",
    summary:
      "Arrow functions have concise syntax and lexically bind `this` from the enclosing scope—no own `this` for methods that need dynamic `this`.",
    questions: [
      {
        prompt: "Arrow functions are a poor default choice when you need:",
        choices: [
          "Dynamic `this` from the call site like a traditional object method",
          "Implicit returns of objects with concise bodies",
          "A short callback for `array.map`",
          "Lexical `this` capture",
        ],
        correctIndex: 0,
        explanation:
          "Use a normal method/function when callers rely on dynamic `this` binding.",
      },
    ],
  },
  {
    slug: "javascript-specials",
    title: "JavaScript specials",
    part: 1,
    chapter: "JavaScript Fundamentals",
    order: 27,
    officialUrl: "https://javascript.info/javascript-specials",
    summary:
      "Review tricky bits: semicolons, automatic semicolon insertion edges, named quirks, and patterns worth memorizing.",
    questions: [
      {
        prompt: "A takeaway from 'specials' lessons is usually to:",
        choices: [
          "Know the edge cases and prefer explicit, readable patterns",
          "Avoid all loops",
          "Disable strict mode everywhere",
          "Never use functions as values",
        ],
        correctIndex: 0,
        explanation:
          "Understanding quirks helps you write predictable code and debug faster.",
      },
    ],
  },

  /* --- Code quality --- */
  {
    slug: "code-quality",
    title: "Code quality",
    part: 1,
    chapter: "Code quality",
    order: 28,
    officialUrl: "https://javascript.info/code-quality",
    summary:
      "This chapter is about habits that keep code readable and safe to change: debugging fluency, consistent style, useful comments, tests, and shipping modern syntax to older engines.",
    questions: [
      {
        prompt:
          "Which practice most directly catches regressions when you refactor?",
        choices: [
          "Automated tests that exercise key behaviors",
          "Deleting all comments",
          "Using only one-letter names",
          "Disabling strict mode everywhere",
        ],
        correctIndex: 0,
        explanation:
          "Tests encode expectations so changes are less likely to break behavior silently.",
      },
    ],
  },
  {
    slug: "debugging-chrome",
    title: "Debugging in the browser",
    part: 1,
    chapter: "Code quality",
    order: 29,
    officialUrl: "https://javascript.info/debugging-chrome",
    summary:
      "Breakpoints, stepping, the call stack, watches, and `debugger` let you inspect live state. Console logging complements stepping when you need coarse tracing.",
    questions: [
      {
        prompt:
          "A breakpoint pauses execution so you can inspect variables at that line. You usually set one in devtools by clicking:",
        choices: [
          "The line number in the Sources / editor gutter",
          "The browser refresh button only",
          "The favicon in the tab",
          "Network throttling presets only",
        ],
        correctIndex: 0,
        explanation:
          "Clicking the gutter toggles a breakpoint where execution should freeze.",
      },
    ],
  },
  {
    slug: "coding-style",
    title: "Coding style",
    part: 1,
    chapter: "Code quality",
    order: 30,
    officialUrl: "https://javascript.info/coding-style",
    summary:
      "Consistent braces, indentation, line length, and semicolons reduce cognitive load. Team style guides and linters turn preferences into repeatable checks.",
    questions: [
      {
        prompt:
          "A linter is primarily useful for:",
        choices: [
          "Automated style checks that can also catch some bugs",
          "Compiling TypeScript to Java bytecode",
          "Rendering 3D scenes",
          "Encrypting environment variables",
        ],
        correctIndex: 0,
        explanation:
          "Linters encode rules about patterns and naming; many issues surface as warnings before runtime.",
      },
    ],
  },
  {
    slug: "comments",
    title: "Comments",
    part: 1,
    chapter: "Code quality",
    order: 31,
    officialUrl: "https://javascript.info/comments",
    summary:
      "Prefer self-descriptive code; use comments for architecture, non-obvious rationale, and API docs (for example JSDoc). Avoid narrating what each line literally does.",
    questions: [
      {
        prompt:
          "What is usually a better fix than a long comment explaining confusing code?",
        choices: [
          "Refactor into smaller, well-named functions",
          "Add more global variables",
          "Nest ten levels deep",
          "Disable all error handling",
        ],
        correctIndex: 0,
        explanation:
          "Structure and naming often communicate intent better than inline narration.",
      },
    ],
  },
  {
    slug: "ninja-code",
    title: "Ninja code",
    part: 1,
    chapter: "Code quality",
    order: 32,
    officialUrl: "https://javascript.info/ninja-code",
    summary:
      "A satirical catalog of anti-patterns: ultra-short code, vague names, accidental shadowing, and surprise side effects. The lesson warns what rattles reviewers and future you.",
    questions: [
      {
        prompt:
          "Which habit most hurts maintainability on a shared codebase?",
        choices: [
          "Obscure or inconsistent naming that hides intent",
          "Writing small, focused functions",
          "Consistent formatting with a shared style guide",
          "Using `===` for equality checks",
        ],
        correctIndex: 0,
        explanation:
          "Readable names and predictable structure beat clever brevity for long-term cost.",
      },
    ],
  },
  {
    slug: "testing-mocha",
    title: "Automated testing with Mocha",
    part: 1,
    chapter: "Code quality",
    order: 33,
    officialUrl: "https://javascript.info/testing-mocha",
    summary:
      "Behavior-driven specs (`describe`/`it`) plus assertions document intent and guard refactors. The typical loop is red → green → refine as requirements grow.",
    questions: [
      {
        prompt:
          "In a BDD-style test, `it(\"…\")` blocks usually represent:",
        choices: [
          "One focused behavior or scenario",
          "The entire production bundle",
          "A database migration file",
          "A CSS animation keyframe",
        ],
        correctIndex: 0,
        explanation:
          "Granular `it` cases localize failures and clarify what broke.",
      },
    ],
  },
  {
    slug: "polyfills",
    title: "Polyfills and transpilers",
    part: 1,
    chapter: "Code quality",
    order: 34,
    officialUrl: "https://javascript.info/polyfills",
    summary:
      "Transpilers rewrite newer syntax to older equivalents; polyfills implement missing built-ins at runtime. Use compatibility tables to match your target engines.",
    questions: [
      {
        prompt:
          "A polyfill most directly addresses:",
        choices: [
          "Missing built-in functions or methods on older engines",
          "Slow CSS animations only",
          "Broken HTTPS certificates",
          "GPU driver updates",
        ],
        correctIndex: 0,
        explanation:
          "Polyfills supply implementations the engine lacks; transpilers adjust syntax.",
      },
    ],
  },

  /* --- Objects: the basics --- */
  {
    slug: "object-basics",
    title: "Objects: the basics",
    part: 1,
    chapter: "Objects: the basics",
    order: 35,
    officialUrl: "https://javascript.info/object-basics",
    summary:
      "Objects bundle keyed properties and underpin arrays, dates, and most APIs. This chapter moves from literals and copying to `this`, constructors, symbols, and primitive conversion hooks.",
    questions: [
      {
        prompt:
          "Plain objects in JS are best thought of as:",
        choices: [
          "Keyed property bags (and the basis for many built-in types)",
          "A replacement for WebAssembly modules",
          "Immutable tuples enforced by the engine",
          "Only usable inside JSON files",
        ],
        correctIndex: 0,
        explanation:
          "Nearly everything non-primitive builds on object semantics in JavaScript.",
      },
    ],
  },
  {
    slug: "object",
    title: "Objects",
    part: 1,
    chapter: "Objects: the basics",
    order: 36,
    officialUrl: "https://javascript.info/object",
    summary:
      "Literals `{ }`, dot vs bracket access, computed keys, property shorthand, `delete`, `in`, and `for..in` traversals—plus ordering quirks for integer-like keys.",
    questions: [
      {
        prompt:
          "Which syntax lets you read a property whose key is stored in a variable `key`?",
        choices: ["obj[key]", "obj.key only", "obj::key", "obj@key"],
        correctIndex: 0,
        explanation:
          "Bracket notation evaluates `key` dynamically; dot notation requires a fixed identifier.",
      },
    ],
  },
  {
    slug: "object-copy",
    title: "Object references and copying",
    part: 1,
    chapter: "Objects: the basics",
    order: 37,
    officialUrl: "https://javascript.info/object-copy",
    summary:
      "Assignment copies references, not deep object graphs. Shallow clones (`Object.assign`, spread) differ from deep clones (`structuredClone` or bespoke walks).",
    questions: [
      {
        prompt:
          "After `const a = {}; const b = a;`, mutating `b.x = 1` affects `a.x` because:",
        choices: [
          "Both identifiers point at the same object",
          "`const` duplicates the object automatically",
          "Objects copy by value like numbers",
          "The engine merges objects by name",
        ],
        correctIndex: 0,
        explanation:
          "`const` freezes reassignment of the binding, not mutation of the referenced object.",
      },
    ],
  },
  {
    slug: "garbage-collection",
    title: "Garbage collection",
    part: 1,
    chapter: "Objects: the basics",
    order: 38,
    officialUrl: "https://javascript.info/garbage-collection",
    summary:
      "Reachability from roots determines lifetime; unreachable object graphs are reclaimed automatically via strategies like mark-and-sweep, often optimized for short-lived allocations.",
    questions: [
      {
        prompt:
          "An object becomes eligible for GC when it is:",
        choices: [
          "Unreachable from roots like globals and active call stacks",
          "Declared with `let` instead of `var`",
          "Stored in a CSS file",
          "Referenced only by itself in a closure you never call",
        ],
        correctIndex: 0,
        explanation:
          "If no path from roots exists, the collector can free the whole unreachable island.",
      },
    ],
  },
  {
    slug: "object-methods",
    title: 'Object methods, "this"',
    part: 1,
    chapter: "Objects: the basics",
    order: 39,
    officialUrl: "https://javascript.info/object-methods",
    summary:
      "Methods are functions stored on objects. `this` is resolved at call time—usually the receiver before the dot—while arrow functions inherit `this` from the enclosing scope.",
    questions: [
      {
        prompt:
          "For a normal call `obj.m()`, inside `m` the `this` value is typically:",
        choices: ["obj", "the global object always", "undefined always", "`m` itself"],
        correctIndex: 0,
        explanation:
          "Method calls set `this` to the base object unless explicitly bound or invoked differently.",
      },
    ],
  },
  {
    slug: "constructor-new",
    title: 'Constructor, operator "new"',
    part: 1,
    chapter: "Objects: the basics",
    order: 40,
    officialUrl: "https://javascript.info/constructor-new",
    summary:
      "`new Fn()` creates a fresh object, binds it to `this`, runs `Fn`, and returns the populated instance (unless an object is explicitly returned).",
    questions: [
      {
        prompt:
          "Constructor functions meant for use with `new` are conventionally named with:",
        choices: [
          "A capitalized first letter (e.g., `User`)",
          "Only emoji characters",
          "Leading underscores only",
          "All lowercase and trailing `Async`",
        ],
        correctIndex: 0,
        explanation:
          "PascalCase signals `new`-able constructors to readers and tooling.",
      },
    ],
  },
  {
    slug: "optional-chaining",
    title: "Optional chaining '?.'",
    part: 1,
    chapter: "Objects: the basics",
    order: 41,
    officialUrl: "https://javascript.info/optional-chaining",
    summary:
      "`value?.prop` short-circuits on `null` or `undefined`. Variants cover calls (`?.()`) and dynamic keys (`?.[expr]`), but optional chaining is not valid on the left of assignment.",
    questions: [
      {
        prompt:
          "`user?.address?.street` returns `undefined` without throwing when:",
        choices: [
          "`user` or `address` is missing (`null`/`undefined`)",
          "`street` is an empty string",
          "The script is minified",
          "You forgot semicolons",
        ],
        correctIndex: 0,
        explanation:
          "Only `null`/`undefined` short-circuit; other falsy values keep traversing.",
      },
    ],
  },
  {
    slug: "symbol",
    title: "Symbol type",
    part: 1,
    chapter: "Objects: the basics",
    order: 42,
    officialUrl: "https://javascript.info/symbol",
    summary:
      "`Symbol()` creates unique primitive keys—handy for collisions-free metadata. Global symbols use `Symbol.for`, and well-known `Symbol.*` hooks customize built-in behavior.",
    questions: [
      {
        prompt:
          "Two calls `Symbol('id')` and `Symbol('id')` produce values that are:",
        choices: ["Always different symbols", "Always equal", "Strings", "BigInts"],
        correctIndex: 0,
        explanation:
          "Each `Symbol()` call is unique; descriptions are for debugging only.",
      },
    ],
  },
  {
    slug: "object-toprimitive",
    title: "Object to primitive conversion",
    part: 1,
    chapter: "Objects: the basics",
    order: 43,
    officialUrl: "https://javascript.info/object-toprimitive",
    summary:
      "Operators coerce objects via hints (`string`, `number`, `default`). Customize with `Symbol.toPrimitive`, or fall back to `valueOf` / `toString` with well-defined ordering.",
    questions: [
      {
        prompt:
          "Hooks like `Symbol.toPrimitive` exist so objects can:",
        choices: [
          "Control how they coerce to primitives for operations like `+` or `alert`",
          "Disable garbage collection entirely",
          "Replace `fetch` globally",
          "Compile TypeScript",
        ],
        correctIndex: 0,
        explanation:
          "Coercion rules dispatch to these methods before applying the operator to primitives.",
      },
    ],
  },
];
