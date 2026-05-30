import type { CourseModule } from "../types";

export const webBasicsModule: CourseModule = {
  id: "web",
  title: "Computers & the web",
  description:
    "Clients, servers, HTTP, and how data crosses the wire—your full-stack baseline.",
  icon: "🌐",
  accentClass: "border-sky-400/60 shadow-sky-500/10",
  lessons: [
    {
      id: "how-requests-work",
      title: "How a browser request travels",
      description: "DNS, TCP, HTTP—one clear story.",
      blocks: [
        {
          type: "text",
          html: `
            <p>When you visit a site, your <strong>browser</strong> (client) asks the network how to reach a <strong>server</strong> program listening on the internet.</p>
            <ol>
              <li><strong>DNS</strong> maps a name like <code>example.com</code> to an IP address.</li>
              <li><strong>TCP</strong> sets up a reliable connection to that IP and port.</li>
              <li><strong>HTTP</strong> is the message format: verbs like GET/POST, paths, headers, bodies.</li>
            </ol>
            <p>The server responds with a <strong>status code</strong> (e.g. 200 OK) and a body (often HTML, JSON, or a redirect).</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Full-stack view",
          html: "Frontend code runs in the browser; backend code runs where HTTP is handled and business rules, databases, and integrations live.",
        },
        {
          type: "quiz",
          q: "Which layer translates example.com into an IP address?",
          options: ["HTTP", "DNS", "CSS", "React"],
          answer: 1,
          why: "DNS is the phone book of hostnames to IP addresses.",
        },
      ],
    },
    {
      id: "json-and-apis",
      title: "JSON and APIs",
      description: "The shape modern apps use to trade data.",
      blocks: [
        {
          type: "text",
          html: `
            <p><strong>JSON</strong> (JavaScript Object Notation) is a text format for nested data: objects <code>{}</code>, arrays <code>[]</code>, strings, numbers, booleans, and null.</p>
            <p>An <strong>API</strong> over HTTP usually exchanges JSON in request and response bodies. The frontend <em>calls</em> endpoints; the backend <em>implements</em> them.</p>
          `,
        },
        {
          type: "quiz",
          q: "Which is a valid JSON value?",
          options: [
            "{ name: 'Ada' }",
            '{ "name": "Ada", "score": 10 }',
            "<person name='Ada'/>",
            "name = Ada",
          ],
          answer: 1,
          why: "JSON requires double-quoted keys/strings (and no trailing commas in strict parsers).",
        },
        {
          type: "reading",
          title: "MDN: An overview of HTTP",
          href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview",
        },
      ],
    },
  ],
};
