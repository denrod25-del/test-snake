import type { CourseModule } from "../types";

export const backendModule: CourseModule = {
  id: "backend",
  title: "Backend I",
  description: "HTTP handlers, validation, errors, and security instincts.",
  icon: "⌁",
  accentClass: "border-teal-400/60 shadow-teal-500/10",
  lessons: [
    {
      id: "what-backend-does",
      title: "What a backend actually does",
      description: "From socket to useful JSON.",
      blocks: [
        {
          type: "text",
          html: `
            <p>The <strong>backend</strong> is where trusted work happens: authentication, business rules, talking to databases, payments, email—things you don’t want to forge in the browser.</p>
            <p>Most backends you’ll build first speak <strong>HTTP</strong>. A request arrives: method (<code>GET</code>, <code>POST</code>, …), path, headers, maybe a JSON body. Your code validates input, does work, returns a response.</p>
            <p>In Next.js you can implement HTTP with <strong>Route Handlers</strong> like <code>route.ts</code>—same project as your UI, different responsibility.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Trust boundaries",
          html: "Anything from the client can be tampered with—re-validate permissions and data on the server.",
        },
        {
          type: "quiz",
          q: "Why keep payment capture on the server?",
          options: [
            "Browsers cannot display dollars",
            "Clients can be modified; servers enforce real authorization and secrets",
            "HTTP only works server-to-server",
            "JSON forbids purchases",
          ],
          answer: 1,
          why: "Secrets and authority live server-side; the client is an untrusted attendee.",
        },
        {
          type: "reading",
          title: "Next.js: Route Handlers",
          href: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers",
        },
      ],
    },
    {
      id: "status-codes-errors",
      title: "Status codes & honest errors",
      description: "Say what happened in HTTP terms.",
      blocks: [
        {
          type: "text",
          html: `
            <p>HTTP <strong>status codes</strong> tell clients what happened: <strong>2xx</strong> success, <strong>4xx</strong> caller mistakes (bad input, auth), <strong>5xx</strong> server problems.</p>
            <p>Good APIs pair codes with JSON bodies that explain validation errors (field-level) for humans and machines—without leaking secrets or stack traces in production.</p>
          `,
        },
        {
          type: "quiz",
          q: "A user sends invalid JSON. Which family fits best?",
          options: [
            "2xx — always success",
            "4xx — client error (e.g. 400 Bad Request)",
            "5xx — always use for validation",
            "301 — invalid JSON means moved permanently",
          ],
          answer: 1,
          why: "Malformed or invalid input is the caller’s responsibility to fix—4xx.",
        },
        {
          type: "reading",
          title: "MDN: HTTP response status codes",
          href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
        },
      ],
    },
  ],
};
