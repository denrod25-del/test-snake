import type { Metadata } from "next";
import Link from "next/link";
import { TRACKS } from "@/data/tracks";

export const metadata: Metadata = {
  title: "Tracks",
};

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-12 sm:px-6 lg:px-8 space-y-12">
      <header className="max-w-3xl space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
          Guided curricula
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Learning tracks stitched from archived shelves.
        </h1>
        <p className="text-slate-400">
          Tracks are authored here in the hub, but readings themselves still live on
          the Swiss Bay mirror. Each stage links opens the corresponding shelf filtered
          in the Library view so you stay inside the gigantic PDF graph without getting
          lost.
        </p>
      </header>
      <div className="space-y-14">
        {TRACKS.map((track) => (
          <article
            key={track.id}
            className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-black/40 p-[1px] shadow-2xl shadow-black/55"
          >
            <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/90 p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white">{track.title}</h2>
                <p className="text-sm text-slate-400">{track.summary}</p>
              </div>
              <ol className="space-y-5">
                {track.steps.map((step, idx) => (
                  <li
                    key={step.category + idx}
                    className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/65 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      {(idx + 1).toString().padStart(2, "0")}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-base font-semibold text-white">
                          {step.title}
                        </div>
                        <p className="text-sm text-slate-400">{step.caption}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs font-medium">
                        <Link
                          href={`/library?cat=${encodeURIComponent(step.category)}`}
                          className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-emerald-950 shadow-md shadow-black/35 hover:bg-emerald-400 cursor-pointer"
                        >
                          Open shelf in library
                        </Link>
                        <a
                          className="inline-flex items-center rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-sky-400/60 cursor-pointer"
                          href={`https://theswissbay.ch/pdf/${encodeURIComponent("Gentoomen Library")}/${encodeURIComponent(
                            step.category
                          )}/`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View raw Swiss Bay listing
                        </a>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Shelf:&nbsp;
                        <span className="text-slate-300">{step.category}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
