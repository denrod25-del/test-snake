import type { CourseModule } from "../types";

export const frontendModule: CourseModule = {
  id: "frontend",
  title: "Frontend I",
  description:
    "HTML, CSS, layout, and accessibility—structure users can actually use.",
  icon: "▣",
  accentClass: "border-pink-400/60 shadow-pink-500/10",
  lessons: [
    {
      id: "semantic-html",
      title: "Semantic HTML & meaning",
      description: "Tags that describe content, not just boxes.",
      blocks: [
        {
          type: "text",
          html: `
            <p>HTML gives your page <strong>structure</strong>. Browsers, search engines, and assistive tech use that structure to understand what’s on screen.</p>
            <p><strong>Semantic</strong> tags carry meaning: <code>&lt;main&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;button&gt;</code>. A <code>&lt;div&gt;</code> is a neutral box—fine when no better tag exists.</p>
            <p>Rule of thumb: if it’s a heading, use <code>h1</code>–<code>h6</code>. If it’s navigation, use <code>nav</code>. If it performs an action, prefer <code>button</code> over a clickable <code>div</code>.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Accessibility",
          html: "Add concise <code>alt</code> text on images that convey information. Decorative images can use empty <code>alt=\"\"</code> so screen readers skip them.",
        },
        {
          type: "quiz",
          q: "Which choice best honors semantics and keyboard users?",
          options: [
            "<code>&lt;div onclick='...'&gt;</code> styled as a button",
            "<code>&lt;button type='button'&gt;</code> with a clear label",
            "<code>&lt;span&gt;</code> with no role for every control",
            "Only images with filenames as visible captions",
          ],
          answer: 1,
          why: "Native elements get focus, roles, and events right; div-as-button breaks expectations unless you add extra ARIA and behavior.",
        },
        {
          type: "reading",
          title: "MDN: HTML elements reference",
          href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element",
        },
      ],
    },
    {
      id: "css-layout-flow",
      title: "CSS: flow, box model, flex",
      description: "How layout actually works in the browser.",
      blocks: [
        {
          type: "text",
          html: `
            <p>CSS controls <strong>presentation</strong>: size, spacing, color, typography, layout.</p>
            <p>The <strong>box model</strong> is content + padding + border + margin. <code>box-sizing: border-box</code> (common reset) makes width include padding and border—easier mental math.</p>
            <p><strong>Normal flow</strong> stacks block elements vertically. <strong>Flexbox</strong> (one-dimensional) lines items along a row or column and excels at alignment and spacing. Most app shells and toolbars are flex-first.</p>
          `,
        },
        {
          type: "callout",
          tone: "warn",
          label: "Gotcha",
          html: "Don’t fight the browser with absolute positioning for whole-page layout until you understand flow—flex and grid solve most product UIs.",
        },
        {
          type: "quiz",
          q: "What does `display: flex` establish on a container?",
          options: [
            "A 2D grid of rows and columns only",
            "A flex formatting context for laying out its children along one main axis",
            "Automatic database columns",
            "Server-side rendering of CSS",
          ],
          answer: 1,
          why: "Flex lays out children along a main axis (row or column) with powerful alignment knobs.",
        },
        {
          type: "reading",
          title: "MDN: CSS box model",
          href: "https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/The_box_model",
        },
      ],
    },
  ],
};
