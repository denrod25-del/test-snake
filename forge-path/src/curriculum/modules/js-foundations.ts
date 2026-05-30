import type { CourseModule } from "../types";

export const jsFoundationsModule: CourseModule = {
  id: "javascript",
  title: "JavaScript foundations",
  description:
    "Values, variables, and functions—the core language under React and Node.",
  icon: "JS",
  accentClass: "border-amber-400/60 shadow-amber-500/10",
  lessons: [
    {
      id: "values-and-types",
      title: "Values and types (no memorization theater)",
      description: "A mental model you can actually use.",
      blocks: [
        {
          type: "text",
          html: `
            <p>JavaScript values belong to broad categories you will feel in real code: <strong>strings</strong>, <strong>numbers</strong>, <strong>booleans</strong>, <strong>null</strong>, <strong>undefined</strong>, <strong>BigInt</strong>, <strong>symbols</strong>, and <strong>objects</strong> (including arrays and functions).</p>
            <p><code>typeof</code> helps at the console, but your real job is to know what a value <em>means</em> at a boundary: user input, API JSON, database rows.</p>
          `,
        },
        {
          type: "quiz",
          q: "Which expression is most likely to bite you at API boundaries?",
          options: [
            'Comparing "" (empty string) with loose == only when you meant strict checks',
            "Using const for values that never rebind",
            "Using template literals for strings",
            "Using Array.map to transform lists",
          ],
          answer: 0,
          why: "Coercion and fuzzy equality confuse string/number/boolean edges—use clear checks and validation at boundaries.",
        },
        {
          type: "reading",
          title: "Eloquent JavaScript (free online)",
          href: "https://eloquentjavascript.net/",
        },
      ],
    },
    {
      id: "functions-and-scope",
      title: "Functions and scope",
      description: "Where names live and how functions close over state.",
      blocks: [
        {
          type: "text",
          html: `
            <p>A <strong>function</strong> packages behavior. In modern JS you will see <code>function</code> declarations, <code>=&gt;</code> arrow functions, and methods.</p>
            <p><strong>Scope</strong> answers: where is this name visible? Blocks (<code>{}</code>), functions, and modules each create boundaries. <strong>Closures</strong> let inner functions remember variables from outer scopes—used heavily in React hooks and callbacks.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Later",
          html: "Don't rush prototypes, <code>this</code>, and classes until functions feel boring—then layer them on with intent.",
        },
        {
          type: "reading",
          title: "You Don't Know JS Yet (get started)",
          href: "https://github.com/getify/You-Dont-Know-JS",
          note: "Deep dives—pair with practice, not marathon reading alone.",
        },
      ],
    },
  ],
};
