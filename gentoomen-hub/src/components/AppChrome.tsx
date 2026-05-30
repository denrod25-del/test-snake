import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/learn", label: "Tracks" },
  { href: "/community", label: "Community" },
];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold uppercase tracking-wide text-white">
              GL
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Gentoomen Hub</div>
              <div className="text-[11px] text-slate-400">
                Open tech commons
              </div>
            </div>
          </Link>
          <nav
            aria-label="Primary"
            className="hidden sm:flex flex-1 items-center gap-1 text-sm"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/library"
            className="ml-auto rounded-full bg-sky-500 px-4 py-2 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35)] hover:bg-sky-400 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            Browse catalog
          </Link>
        </div>
        <nav
          aria-label="Mobile sections"
          className="flex sm:hidden gap-2 overflow-x-auto border-t border-slate-800/70 px-4 py-2 text-xs"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-slate-300 border border-slate-800 hover:border-sky-500/60 cursor-pointer"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-800 mt-16 py-10 text-xs text-slate-500 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
          <p>
            Canonical listing mirrored from{" "}
            <a
              href="https://theswissbay.ch/pdf/Gentoomen%20Library/"
              className="text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              theswissbay.ch/pdf/Gentoomen&nbsp;Library
            </a>
            . Hub metadata is regenerated locally via{" "}
            <code className="rounded bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300">
              npm run crawl
            </code>
            .
          </p>
          <p>
            Respect copyright and redistribution terms that apply to each PDF.
            Links open the mirrored files directly; none are copied into this
            project.
          </p>
        </div>
      </footer>
    </div>
  );
}
