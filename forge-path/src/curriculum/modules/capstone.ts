import type { CourseModule } from "../types";

export const capstoneModule: CourseModule = {
  id: "capstone",
  title: "Capstone: ship an API route",
  description:
    "Wire a real JSON endpoint in this repo—then hit it like production would.",
  icon: "⚡",
  accentClass: "border-yellow-400/70 shadow-yellow-500/15",
  lessons: [
    {
      id: "first-api-route",
      title: "Your first Next.js route handler",
      description:
        "Folders, `route.ts`, GET, and `Response.json`—end to end.",
      blocks: [
        {
          type: "text",
          html: `
            <p>You already ship UI in <code>src/app/**/page.tsx</code>. <strong>Route Handlers</strong> live beside that tree as <code>route.ts</code> files. They export functions named after HTTP verbs (<code>GET</code>, <code>POST</code>, …).</p>
            <p>A minimal JSON health check returns <code>Response.json({ status: 'ok' })</code> with an implicit 200 status. From there you add validation, databases, auth—same HTTP story as any backend.</p>
            <p><strong>Try it:</strong> this repo already includes a starter <code>src/app/api/hello/route.ts</code> so <code>/api/hello</code> works when you run <code>npm run dev</code>. Open it, change the JSON, hit save, refresh—and trace how the file maps to the URL.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Convention",
          html: "The path <code>src/app/api/hello/route.ts</code> maps to URL <code>/api/hello</code>—no extra routing config.",
        },
        {
          type: "drill-fill",
          parts: [
            "API routes in the App Router use a file named ",
            { blank: "route.ts" },
            " placed under ",
            { blank: "src/app/api", accept: ["app/api", "src/app/api/"] },
            ". For read-only data you export a function named ",
            { blank: "GET", accept: ["get"] },
            ".",
          ],
        },
        {
          type: "drill-reorder",
          intro: "Put these steps in the order you would actually do them.",
          lines: [
            "Open or verify `src/app/api/hello/route.ts` exports an async `GET` (starter file is included).",
            "Inside `GET`, `return Response.json({ message: \"forge\" })`.",
            "Run `npm run dev` from the `forge-path` folder.",
            "Visit `http://localhost:3000/api/hello` (or curl it) and see JSON.",
          ],
          correctOrder: [0, 1, 2, 3],
        },
        {
          type: "quiz",
          q: "Why prefer `Response.json` over hand-building a string body?",
          options: [
            "It sets `Content-Type` and serializes safely for typical objects",
            "It disables TypeScript",
            "It only works on Vercel",
            "Browsers reject plain JSON",
          ],
          answer: 0,
          why: "Helpers encode headers and stringify consistently; you avoid subtle MIME issues.",
        },
        {
          type: "reading",
          title: "Next.js: Route Handlers",
          href: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers",
        },
      ],
    },
  ],
};
