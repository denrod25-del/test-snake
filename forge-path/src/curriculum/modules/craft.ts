import type { CourseModule } from "../types";

export const craftModule: CourseModule = {
  id: "craft",
  title: "The craft",
  description:
    "How professionals learn: small steps, fast feedback, and boringly reliable progress.",
  icon: "◇",
  accentClass: "border-violet-400/60 shadow-violet-500/10",
  lessons: [
    {
      id: "feedback-loops",
      title: "Feedback loops beat heroics",
      description: "Why tiny cycles matter more than big pushes.",
      blocks: [
        {
          type: "text",
          html: `
            <p>Software is learned in <strong>loops</strong>: you try something, see what happened, adjust, repeat. The shorter and clearer the loop, the faster you improve.</p>
            <p>A long loop looks like: code for hours, run once, discover a bug, guess what went wrong. A short loop looks like: change one thing, run tests or refresh the page, learn immediately.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Practice",
          html: "When stuck, ask: <em>What is the smallest proof I can get in the next 10 minutes?</em> A log line, a failing test, a sample API response—anything concrete.",
        },
        {
          type: "quiz",
          q: "Which habit usually speeds learning up the most?",
          options: [
            "Coding in silence for hours before running anything",
            "Short try → observe → adjust cycles",
            "Reading only, no building",
            "Copying code without running it",
          ],
          answer: 1,
          why: "Frequent, tight feedback turns mistakes into data instead of mysteries.",
        },
        {
          type: "reading",
          title: "The Pragmatic Programmer (overview)",
          href: "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
          note: "Buy or borrow—the ideas pair well with this track; we don't paste excerpts here.",
        },
      ],
    },
    {
      id: "complexity-budget",
      title: "Your complexity budget",
      description: "Every feature taxes your future self—spend carefully.",
      blocks: [
        {
          type: "text",
          html: `
            <p>Complexity isn't "bad code only." It's <strong>anything that makes change risky</strong>: unclear names, hidden state, clever tricks, undocumented assumptions.</p>
            <p>Teams talk about a <em>budget</em>: you only get so much accidental complexity before delivery slows. Beginners benefit from the same idea: default to the simplest design that could work, then justify extras.</p>
          `,
        },
        {
          type: "callout",
          tone: "warn",
          label: "Watch",
          html: "Frameworks, patterns, and buzzwords are tools—not trophies. If you can't explain why you need one <em>for this project</em>, wait.",
        },
        {
          type: "quiz",
          q: "What best describes a 'complexity budget'?",
          options: [
            "How many libraries your package.json may contain",
            "The tolerance your project has for change-hurting details",
            "How much RAM your server needs",
            "The number of tabs open in your editor",
          ],
          answer: 1,
          why: "It's about how much accidental difficulty the codebase can absorb before every fix feels dangerous.",
        },
      ],
    },
  ],
};
