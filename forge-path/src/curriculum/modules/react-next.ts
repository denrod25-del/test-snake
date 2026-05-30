import type { CourseModule } from "../types";

export const reactNextModule: CourseModule = {
  id: "react-next",
  title: "React & Next.js",
  description: "Components, JSX, and how this App Router project is wired.",
  icon: "⚛",
  accentClass: "border-emerald-400/60 shadow-emerald-500/10",
  lessons: [
    {
      id: "components-and-jsx",
      title: "Components & JSX",
      description: "UI as a function of data.",
      blocks: [
        {
          type: "text",
          html: `
            <p><strong>React</strong> builds interfaces from <strong>components</strong>: reusable pieces that return a tree of elements (often written in <strong>JSX</strong>, HTML-like syntax inside JavaScript).</p>
            <p>Data flows in through <strong>props</strong>. Values that change over time inside a component live in <strong>state</strong> (often <code>useState</code>). When state updates, React re-renders efficiently.</p>
            <p>Think: <em>describe what the UI should look like for a given state</em>, not a long list of manual DOM tweaks.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "You’re using React now",
          html: "Forge Path itself is a Next.js + React app. When you open the repo, peek at <code>src/components</code> to see real components.",
        },
        {
          type: "quiz",
          q: "What usually triggers a React function component to re-render?",
          options: [
            "Editing a CSS file in another project",
            "State updated via a React setter (or parent re-render with new props)",
            "Closing the laptop lid",
            "Only full page reloads, never in-app updates",
          ],
          answer: 1,
          why: "Local state changes and new props from parents schedule re-renders.",
        },
        {
          type: "reading",
          title: "React: Describing the UI",
          href: "https://react.dev/learn/describing-the-ui",
        },
      ],
    },
    {
      id: "next-app-router",
      title: "Next.js App Router in one pass",
      description: "Files as routes, server vs client pieces.",
      blocks: [
        {
          type: "text",
          html: `
            <p><strong>Next.js</strong> adds routing, bundling, and deployment ergonomics on top of React. In the <strong>App Router</strong>, folders under <code>src/app</code> define URL segments.</p>
            <p><code>page.tsx</code> is the UI for that segment. <code>layout.tsx</code> wraps nested segments—great for headers and shared chrome.</p>
            <p>Files without <code>'use client'</code> are <strong>Server Components</strong> by default (data-friendly, no hooks). Add <code>'use client'</code> when you need browser APIs, event handlers, or React hooks like <code>useState</code>.</p>
          `,
        },
        {
          type: "quiz",
          q: "In App Router, which file name renders the `/learn` URL segment?",
          options: [
            "`src/pages/learn.tsx` only",
            "`src/app/learn/page.tsx`",
            "`next.config.js`",
            "`public/learn.html`",
          ],
          answer: 1,
          why: "App Router maps `app/learn/page.tsx` to `/learn`.",
        },
        {
          type: "reading",
          title: "Next.js: Routing fundamentals",
          href: "https://nextjs.org/docs/app/building-your-application/routing",
        },
      ],
    },
  ],
};
