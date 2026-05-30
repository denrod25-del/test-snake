import type { CourseModule } from "../types";

export const dataModule: CourseModule = {
  id: "data",
  title: "Data",
  description: "Tables, keys, SQL reads, and when data gets hard at scale.",
  icon: "🗄",
  accentClass: "border-cyan-400/60 shadow-cyan-500/10",
  lessons: [
    {
      id: "tables-keys-relations",
      title: "Tables, keys, relations (lite)",
      description: "How relational data is shaped.",
      blocks: [
        {
          type: "text",
          html: `
            <p>A <strong>relational</strong> database stores rows in <strong>tables</strong>. Each row is usually identified by a stable <strong>primary key</strong> (often a surrogate id).</p>
            <p>Tables link through <strong>foreign keys</strong>: “this order’s <code>customer_id</code> points at <code>customers.id</code>.” That models real-world relationships without duplicating whole customer blobs everywhere.</p>
            <p>At scale, choices about keys, indexes, and consistency trade off speed and complexity—topics you’ll meet in books like <em>Designing Data-Intensive Applications</em> later.</p>
          `,
        },
        {
          type: "callout",
          tone: "tip",
          label: "Mental model",
          html: "Normalization reduces duplication; denormalization speeds reads—teams tune between them as products grow.",
        },
        {
          type: "quiz",
          q: "What best describes a foreign key?",
          options: [
            "A password for CSV files",
            "A reference from one table’s column to another table’s key",
            "The primary key of every table must be a UUID only",
            "A browser cookie key",
          ],
          answer: 1,
          why: "Foreign keys encode relationships between rows in different tables.",
        },
        {
          type: "reading",
          title: "PostgreSQL: Tutorial intro (SELECT)",
          href: "https://www.postgresql.org/docs/current/tutorial-select.html",
          note: "Skim if you’re new; any major SQL engine has the same SELECT basics.",
        },
      ],
    },
    {
      id: "sql-reads-intuition",
      title: "Reading data with SQL",
      description: "SELECT, WHERE, JOIN in plain language.",
      blocks: [
        {
          type: "text",
          html: `
            <p><strong>SELECT</strong> chooses columns, <strong>FROM</strong> picks a table, <strong>WHERE</strong> filters rows, then you can <strong>ORDER</strong> and <strong>LIMIT</strong>.</p>
            <p><strong>JOIN</strong> combines rows from two tables when keys match—inner joins keep matches only; outer joins keep non-matches with nulls on the missing side.</p>
            <p>When learning, write tiny queries in a sandbox and <em>explain</em> them to yourself: “Give me orders placed after March 1 with customer email.”</p>
          `,
        },
        {
          type: "quiz",
          q: "Which clause filters rows before grouping/aggregating in basic queries?",
          options: ["ORDER BY", "FROM", "WHERE", "LIMIT"],
          answer: 2,
          why: "WHERE filters rows early; HAVING filters after GROUP BY when you add aggregates.",
        },
        {
          type: "reading",
          title: "MDN: SQL basics",
          href: "https://developer.mozilla.org/en-US/docs/Glossary/SQL",
        },
      ],
    },
  ],
};
