import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Library | Forge Path",
};

const sections: {
  title: string;
  items: { label: string; href: string; note?: string }[];
}[] = [
  {
    title: "Craft & professionalism",
    items: [
      {
        label: "The Pragmatic Programmer (official)",
        href: "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
      },
      {
        label: "Code Complete (Microsoft Press / Pearson)",
        href: "https://www.microsoftpressstore.com/store/code-complete-9780735619678",
      },
    ],
  },
  {
    title: "Clean code & architecture",
    items: [
      {
        label: "Clean Code — Robert C. Martin (Pearson)",
        href: "https://www.pearson.com/en-us/subject-catalog/p/clean-code-a-handbook-of-agile-software-craftsmanship/P200000009744",
      },
      {
        label: "Clean Architecture — Robert C. Martin (Pearson)",
        href: "https://www.pearson.com/en-us/subject-catalog/p/clean-architecture-a-craftsman-s-guide-to-software-structure-and-design/P200000009500",
      },
    ],
  },
  {
    title: "JavaScript",
    items: [
      {
        label: "Eloquent JavaScript (free online)",
        href: "https://eloquentjavascript.net/",
      },
      {
        label: "You Don't Know JS Yet (GitHub)",
        href: "https://github.com/getify/You-Dont-Know-JS",
      },
    ],
  },
  {
    title: "Algorithms",
    items: [
      {
        label: "Introduction to Algorithms (MIT Press — CLRS)",
        href: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/",
        note: "Use as a reference; pair with short practice problems.",
      },
    ],
  },
  {
    title: "Data-intensive systems",
    items: [
      {
        label: "Designing Data-Intensive Applications (O’Reilly)",
        href: "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/",
        note: "Start with reliability/scaling chapters at a high level.",
      },
    ],
  },
  {
    title: "Testing",
    items: [
      {
        label: "Test-Driven Development: By Example (Pearson)",
        href: "https://www.pearson.com/en-us/subject-catalog/p/test-driven-development-by-example/P200000000179",
      },
    ],
  },
];

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-zinc-50">Library</h1>
      <p className="mt-4 text-zinc-400">
        Primary sources for deeper reading. Forge Path lessons are original;
        use these publishers and authors for the full depth of each topic.
      </p>
      <div className="mt-10 space-y-10">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              {s.title}
            </h2>
            <ul className="mt-4 space-y-4">
              {s.items.map((item) => (
                <li
                  key={item.href}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sky-400 underline-offset-2 hover:underline"
                  >
                    {item.label}
                  </a>
                  {item.note ? (
                    <p className="mt-2 text-sm text-zinc-500">{item.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
