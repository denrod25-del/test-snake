"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { PdfRecord } from "@/lib/catalog";
import { PdfRowActions } from "@/components/PdfRowActions";

type Props = {
  pdfs: PdfRecord[];
  initialCategory?: string | null;
};

function highlight(text: string, q: string) {
  const t = text.toLowerCase();
  const needle = q.trim().toLowerCase();
  if (!needle) return text;
  const idx = t.indexOf(needle);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-500/25 text-amber-100 rounded px-0.5">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}

export default function LibraryExplorer({ pdfs, initialCategory }: Props) {
  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of pdfs) s.add(p.topCategory);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [pdfs]);

  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    if (!initialCategory) return;
    const match = categories.find(
      (c) => c.toLowerCase() === initialCategory.toLowerCase()
    );
    setCategory(match ?? "All");
  }, [initialCategory, categories]);

  const filtered = useMemo(() => {
    return pdfs.filter((p) => {
      const catOk =
        category === "All" ? true : p.topCategory.toLowerCase() === category.toLowerCase();
      if (!deferred) return catOk;
      const hay =
        `${p.title} ${p.path}`.toLowerCase();
      return catOk && hay.includes(deferred);
    });
  }, [pdfs, category, deferred]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Full-text PDF catalog
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Filters run entirely in-browser on the regenerated manifest. Click a
            title (or path) to open the PDF on the Swiss Bay mirror in a new tab.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/70 to-slate-950 p-5 shadow-xl shadow-black/40 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="q" className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Query
            </label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, subdirectory, acronym…"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="cat"
              className="block text-[11px] uppercase tracking-[0.2em] text-slate-500"
            >
              Category (top-level shelf)
            </label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
            className="inline-flex h-[42px] items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-slate-500 tabular-nums">
          Showing{" "}
          <span className="text-slate-300 font-semibold">{filtered.length}</span>{" "}
          titles
          {deferred ? (
            <>
              {" "}
              matching <span className="text-sky-300">&ldquo;{query.trim()}&rdquo;</span>
            </>
          ) : null}
        </p>
      </div>
      <section
        aria-label="Results"
        className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/75 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Title
              </th>
              <th scope="col" className="px-4 py-3 font-medium hidden sm:table-cell">
                Shelf
              </th>
              <th scope="col" className="px-4 py-3 font-medium hidden md:table-cell">
                Path fragment
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {filtered.map((p, i) => (
              <tr
                key={`${p.url}-${i}`}
                className="hover:bg-slate-900/40 transition-colors odd:bg-slate-950/40 even:bg-slate-950"
              >
                <td className="px-4 py-2.5 text-slate-100 align-middle">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/title inline-block max-w-full cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    aria-label={`Open PDF: ${p.title}`}
                  >
                    <span className="font-medium text-sky-200 group-hover/title:text-sky-100 group-hover/title:underline decoration-sky-500/60 underline-offset-2">
                      {highlight(p.title, query.trim())}
                    </span>
                  </a>
                  <div className="text-[11px] text-slate-500 mt-1 sm:hidden">
                    {p.topCategory}
                  </div>
                </td>
                <td className="hidden sm:table-cell px-4 py-2.5 text-slate-300 align-middle text-xs">
                  {p.topCategory}
                </td>
                <td className="hidden md:table-cell px-4 py-2.5 align-middle">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/path block max-w-xl cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    aria-label={`Open PDF via path: ${p.path}`}
                  >
                    <code className="text-[11px] text-slate-400 truncate block whitespace-nowrap overflow-hidden group-hover/path:text-sky-200 group-hover/path:underline underline-offset-2">
                      {p.path}
                    </code>
                  </a>
                </td>
                <td className="px-4 py-2.5 align-middle">
                  <PdfRowActions pdf={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-slate-500">
            No entries match — relax the query or clear the shelf filter.
          </p>
        ) : null}
      </section>
    </div>
  );
}
