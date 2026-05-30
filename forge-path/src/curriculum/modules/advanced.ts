import type { CourseModule } from "../types";

export const advancedModules: CourseModule[] = [
  {
    id: "quality",
    title: "Code quality",
    description: "Names, functions, and clarity under time pressure.",
    icon: "✎",
    accentClass: "border-indigo-400/60 shadow-indigo-500/10",
    lessons: [
      {
        id: "naming-intent",
        title: "Names carry intent",
        description: "What a reader should guess without spelunking.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Good <strong>names</strong> answer why something exists. Vague names force readers to trace control flow for basic facts.</p>
              <p>Prefer specific verbs for functions (<code>fetchUserProfile</code>, not <code>doStuff</code>). Booleans read well as questions (<code>isAuthenticated</code>, <code>hasExpired</code>).</p>
            `,
          },
          {
            type: "quiz",
            q: "Which name best fits a function that loads a user primary email?",
            options: ["`data`", "`handle`", "`fetchUserPrimaryEmail`", "`x`"],
            answer: 2,
            why: "Verb + object + narrowing detail beats vague placeholders.",
          },
          {
            type: "reading",
            title: "Clean Code (Pearson)",
            href: "https://www.pearson.com/en-us/subject-catalog/p/clean-code-a-handbook-of-agile-software-craftsmanship/P200000009744",
          },
        ],
      },
      {
        id: "small-functions",
        title: "Small functions, one job",
        description: "When to split and when you have gone too far.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Functions should do <strong>one thing</strong> at the abstraction level you name them. If you read a function and hear and also, consider extracting helpers.</p>
              <p>Extreme splitting hurts too: micro-functions with no meaning add navigation overhead. Aim for testable slices with obvious inputs and outputs.</p>
            `,
          },
          {
            type: "callout",
            tone: "warn",
            label: "Pragmatism",
            html: "Shipping clean-enough code beats gold-plating. Refactor when the next change feels scary.",
          },
          {
            type: "quiz",
            q: "A long function mixes HTTP parsing, DB writes, and email. Best next step?",
            options: [
              "Add TODO comments only",
              "Extract cohesive steps named for each responsibility",
              "Rename variables to tmp",
              "Delete tests",
            ],
            answer: 1,
            why: "Separate responsibilities make testing and debugging tractable.",
          },
        ],
      },
    ],
  },
  {
    id: "boundaries",
    title: "Design and boundaries",
    description: "Modules and dependency direction without ceremony.",
    icon: "⎈",
    accentClass: "border-fuchsia-400/60 shadow-fuchsia-500/10",
    lessons: [
      {
        id: "what-modules-are-for",
        title: "What modules are for",
        description: "Hide details, expose intent.",
        blocks: [
          {
            type: "text",
            html: `
              <p>A <strong>module</strong> is a boundary: it exposes a small surface and keeps internals private. Good boundaries mean you can change implementation without rewiring the world.</p>
              <p>Deep import cycles (A imports B imports A) signal a design smell—extract shared pieces or rethink ownership.</p>
            `,
          },
          {
            type: "quiz",
            q: "Why separate payment logic from email templates?",
            options: [
              "Emails compile faster",
              "Each area can change independently with clearer ownership",
              "GitHub charges less",
              "Browsers allow one file only",
            ],
            answer: 1,
            why: "Cohesion inside, loose coupling between areas.",
          },
          {
            type: "reading",
            title: "Clean Architecture (Pearson)",
            href: "https://www.pearson.com/en-us/subject-catalog/p/clean-architecture-a-craftsman-s-guide-to-software-structure-and-design/P200000009500",
          },
        ],
      },
      {
        id: "dependency-direction",
        title: "Dependency direction",
        description: "Keep domain logic away from fragile details.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Stable <strong>domain rules</strong> should not depend on volatile details (exact DB vendor, UI framework). Push IO to edges; keep core rules testable.</p>
            `,
          },
          {
            type: "quiz",
            q: "Which direction is usually healthiest?",
            options: [
              "Domain rules import React hooks everywhere",
              "Infrastructure adapts to domain rules",
              "Every component imports raw SQL strings",
              "Copy-paste SQL into all client bundles",
            ],
            answer: 1,
            why: "Domain stays testable; adapters plug in at boundaries.",
          },
        ],
      },
    ],
  },
  {
    id: "testing",
    title: "Testing and TDD intro",
    description: "Proof that behavior holds, in tiny steps.",
    icon: "✓",
    accentClass: "border-lime-400/60 shadow-lime-500/10",
    lessons: [
      {
        id: "what-tests-prove",
        title: "What a test proves",
        description: "Arrange, act, assert.",
        blocks: [
          {
            type: "text",
            html: `
              <p>A test pins one behavior: given a setup, when you act, you assert an outcome. Good tests are readable, focused, and deterministic.</p>
            `,
          },
          {
            type: "callout",
            tone: "tip",
            label: "Start small",
            html: "First tests can cover pure functions like pricing or validation before UI harnesses.",
          },
          {
            type: "quiz",
            q: "Which trio matches classic unit test structure?",
            options: [
              "Copy, paste, pray",
              "Arrange, act, assert",
              "Import, export, default",
              "Plot, twist, sequel",
            ],
            answer: 1,
            why: "AAA keeps each test easy to scan.",
          },
          {
            type: "reading",
            title: "Test-Driven Development (Pearson)",
            href: "https://www.pearson.com/en-us/subject-catalog/p/test-driven-development-by-example/P200000000179",
          },
        ],
      },
      {
        id: "red-green-refactor",
        title: "Red, green, refactor",
        description: "A loop you can finish.",
        blocks: [
          {
            type: "text",
            html: `
              <p><strong>Red:</strong> failing test for the next slice.<br/>
              <strong>Green:</strong> smallest code to pass.<br/>
              <strong>Refactor:</strong> clean up while green.</p>
            `,
          },
          {
            type: "quiz",
            q: "You never see the test fail before implementing. What risk rises?",
            options: [
              "Tests may mirror bugs instead of intent",
              "JSON becomes invalid automatically",
              "Nothing changes",
              "CSS stops parsing",
            ],
            answer: 0,
            why: "A failing run proves the test exercises real behavior.",
          },
        ],
      },
    ],
  },
  {
    id: "algorithms",
    title: "Algorithms (lite)",
    description: "Big-O intuition and choosing the right container.",
    icon: "∑",
    accentClass: "border-orange-400/60 shadow-orange-500/10",
    lessons: [
      {
        id: "big-o-intuition",
        title: "Big-O without dread",
        description: "Rough growth, not calculus exams.",
        blocks: [
          {
            type: "text",
            html: `
              <p><strong>Big-O</strong> classifies how work grows as input size grows. Scanning an array once is O(n). Nested all-pairs comparisons often O(n squared). Balanced lookups often O(log n).</p>
            `,
          },
          {
            type: "quiz",
            q: "Double nested loop over the same array for all pairs: typical growth?",
            options: ["O(1)", "O(log n)", "O(n)", "O(n squared)"],
            answer: 3,
            why: "Roughly n choose 2 comparisons leads to quadratic time.",
          },
          {
            type: "reading",
            title: "Introduction to Algorithms (MIT Press)",
            href: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/",
          },
        ],
      },
      {
        id: "maps-and-sets",
        title: "Maps and sets versus arrays",
        description: "When hashing wins.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Arrays excel at ordered sequences. For membership have I seen this id, a Set or Map usually beats repeated linear scans.</p>
            `,
          },
          {
            type: "quiz",
            q: "Which fits fast uniqueness of string IDs?",
            options: [
              "Array plus repeated includes",
              "Set",
              "Raw TCP packet",
              "CSS flex container",
            ],
            answer: 1,
            why: "Hash sets give average constant-time inserts and lookups for keys.",
          },
        ],
      },
    ],
  },
  {
    id: "reliability",
    title: "Reliability and checklists",
    description: "Edge cases, reviews, humane releases.",
    icon: "▤",
    accentClass: "border-rose-400/60 shadow-rose-500/10",
    lessons: [
      {
        id: "edge-cases",
        title: "Edge cases are the job",
        description: "Empty, huge, duplicate, offline.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Users submit empty forms, huge payloads, duplicate clicks, and go offline mid-flight. Reliability is naming those stories and deciding behavior.</p>
              <p>Short checklists for release and review catch what memory misses under pressure.</p>
            `,
          },
          {
            type: "quiz",
            q: "Which is most reliability-shaped for a network call?",
            options: [
              "Ignore timeouts",
              "Timeouts, retries, sensible fallbacks",
              "Only pick fonts",
              "Disable logging always",
            ],
            answer: 1,
            why: "Partial failure is normal; design explicit behavior.",
          },
          {
            type: "reading",
            title: "Code Complete (Microsoft Press)",
            href: "https://www.microsoftpressstore.com/store/code-complete-9780735619678",
          },
        ],
      },
      {
        id: "review-discipline",
        title: "Review before merge",
        description: "A second brain on diffs.",
        blocks: [
          {
            type: "text",
            html: `
              <p>Reviews catch defects and spread style. Strong reviews ask what fails and how callers handle it.</p>
            `,
          },
          {
            type: "quiz",
            q: "Which question spots missing error handling?",
            options: [
              "Does it compile on Mars?",
              "What fails, how do we surface it, can we recover?",
              "Is the font serif?",
              "Did we avoid using Git?",
            ],
            answer: 1,
            why: "Explicit failure modes reveal gaps.",
          },
        ],
      },
    ],
  },
  {
    id: "ai-builders",
    title: "AI for builders",
    description: "Use models in products without fooling yourself.",
    icon: "✳",
    accentClass: "border-blue-400/60 shadow-blue-500/10",
    lessons: [
      {
        id: "llm-as-api",
        title: "Treat the LLM as an API with a contract",
        description: "Inputs, outputs, rate limits, cost.",
        blocks: [
          {
            type: "text",
            html: `
              <p>A hosted model is a probabilistic function: prompt in, text out, with latency, cost, and limits. Wrap it: validate outputs, sandbox tools, and treat prompts as specs.</p>
            `,
          },
          {
            type: "callout",
            tone: "warn",
            label: "Security",
            html: "Prompt injection exists: untrusted user text should not silently gain privileged tool access.",
          },
          {
            type: "quiz",
            q: "Which habit is production-grade around LLM outputs?",
            options: [
              "Trust JSON blindly",
              "Validate shape, handle empty or refusal, degrade gracefully",
              "Run generated shell as admin",
              "Never log anything",
            ],
            answer: 1,
            why: "Models can be wrong; your app owns the last mile.",
          },
          {
            type: "reading",
            title: "OpenAI platform docs",
            href: "https://platform.openai.com/docs/overview",
            note: "Swap for your provider; patterns are similar.",
          },
        ],
      },
      {
        id: "prompts-context-limits",
        title: "Prompts, context windows, RAG sketch",
        description: "What memory means here.",
        blocks: [
          {
            type: "text",
            html: `
              <p><strong>Prompts</strong> are specifications: role, constraints, format, examples.</p>
              <p><strong>Context windows</strong> are finite. <strong>RAG</strong> retrieves relevant chunks into the prompt instead of pretending the model read your whole corpus.</p>
            `,
          },
          {
            type: "quiz",
            q: "Why use retrieval (RAG) for large docs?",
            options: [
              "PDFs are illegal",
              "Context is bounded; fetch relevant chunks",
              "HTTP forbids bodies",
              "React disallows text",
            ],
            answer: 1,
            why: "Ground answers in sources that fit in the window.",
          },
        ],
      },
    ],
  },
];
