import Link from "next/link";
import { getLibraryIndex } from "@/lib/catalog";

export default async function Home() {
  const index = await getLibraryIndex();

  const topCategories = Object.entries(index.categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const generated = new Date(index.generatedAt);

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
      >
        <div className="absolute -top-48 left-[-10%] h-96 w-[38rem] rounded-full bg-gradient-to-br from-sky-500/25 via-transparent to-purple-600/25 blur-[120px]" />
        <div className="absolute bottom-[-10rem] right-[-5%] h-96 w-[32rem] rounded-full bg-emerald-500/12 blur-[100px]" />
      </div>
      <section className="mx-auto flex max-w-6xl flex-col gap-14 px-4 pb-28 pt-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-6">
          <p className="inline-flex rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200 ring-1 ring-sky-500/40">
            Full mirror index online
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            A humane console for browsing the legendary Gentoomen PDF shelves.
          </h1>
          <p className="text-lg text-slate-300">
            Harness every discovered title from{" "}
            <a
              href="https://theswissbay.ch/pdf/Gentoomen%20Library/"
              className="font-medium text-sky-300 underline-offset-4 hover:text-sky-200 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Swiss&nbsp;Bay&apos;s public listing
            </a>
            : instant search, shelf filters, learning tracks that stitch topics
            together, and bookmarks that mimic GitHub stars—stored locally until
            you wire up a backend.
          </p>
          <div className="flex flex-wrap gap-3 pt-4">
            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-black/35 transition hover:bg-sky-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Open the searchable catalog
            </Link>
            <Link
              href="/learn"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-transparent px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-white/5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Follow curated tracks
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 cursor-pointer"
            >
              Community desk
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-4 border-t border-slate-900/70 pt-6 text-sm md:grid-cols-4 md:divide-x divide-slate-900/70">
            <div className="md:pr-10">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Indexed PDFs
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {index.stats.pdfCount.toLocaleString()}
              </dd>
            </div>
            <div className="md:px-10">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Top-level shelves
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {index.stats.categories.toLocaleString()}
              </dd>
            </div>
            <div className="md:px-10">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Spidered folders
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {index.stats.directoriesVisited.toLocaleString()}
              </dd>
            </div>
            <div className="md:pl-10 col-span-2 md:col-span-1">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Index stamp
              </dt>
              <dd className="mt-2 text-sm text-slate-300 tabular-nums">
                <time dateTime={generated.toISOString()}>
                  {generated.toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          {index.stats.truncatedByMaxDirs !== undefined ? (
            <p className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-xs text-amber-100">
              This build stopped after {index.stats.directoriesVisited} folders
              ({index.stats.truncatedByMaxDirs} budget). Clear{" "}
              <code className="text-[10px]">CRAWL_MAX_DIRS</code> and rerun{" "}
              <code className="text-[10px]">npm run crawl</code> for exhaustive
              coverage.
            </p>
          ) : null}
        </div>
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Busiest stacks on the shelf
              </h2>
              <p className="text-xs text-slate-400 mt-2 max-w-xl">
                Counts inferred from regenerated metadata; click through to skim
                that slice of PDFs instantly.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {topCategories.map(([name, count]) => (
              <Link
                key={name}
                href={`/library?cat=${encodeURIComponent(name)}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 p-4 shadow-lg shadow-black/40 transition hover:-translate-y-[2px] hover:border-sky-500/55 cursor-pointer"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
                  Shelf
                </div>
                <div className="mt-3 text-[15px] font-semibold text-white leading-snug">
                  {name}
                </div>
                <div className="mt-4 tabular-nums text-2xl font-semibold text-slate-100">
                  {count.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    docs
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
