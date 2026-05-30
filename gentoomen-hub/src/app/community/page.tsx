"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProfileCard, useStarredList, STAR_KEY } from "@/components/PdfRowActions";

const ORG_FEED = [
  {
    slug: "/library?cat=Algorithms",
    name: "@gentoo-archivists/algorithms-core",
    blurb:
      "Classical textbooks and notes that keep onsite interviews tethered to reality.",
    stars: "8.9k watchers",
    stack: ["Big-O battlecards", "Competitive notebooks", "Puzzle readers"],
    accent: "from-sky-500/70 to-transparent",
  },
  {
    slug: "/library?cat=Security",
    name: "@crash-containers/defense-reading",
    blurb:
      "Exploit primers bundled with cryptography references for depth beyond blog posts.",
    stars: "5.7k scouts",
    stack: ["Memory corruption", "Network weirdness", "Crypto proofs"],
    accent: "from-rose-500/70 to-transparent",
  },
  {
    slug: `/library?cat=${encodeURIComponent("Game Development")}`,
    name: "@pixel-guild/playable-theory",
    blurb:
      "Graphics groundwork plus playable systems—ideal for realtime engineers.",
    stars: "3.9k explorers",
    stack: ["Engines", "Art tools", "Multiplayer folklore"],
    accent: "from-violet-500/70 to-transparent",
  },
] as const;

export default function CommunityPage() {
  const starred = useStarredList();

  const recentlyStarred = useMemo(
    () => [...starred].sort((a, b) => b.savedAt - a.savedAt),
    [starred]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-12 sm:px-6 lg:px-8 space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">
            Community cockpit
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            GitHub-energy collaboration without cloning the entire social graph.
          </h1>
          <p className="text-slate-400 text-sm">
            Project-style cards route into Library filters while stars stay on-device.
            Add your handle, curate readings, remix the featured orgs—all without signup
            flows until you bolt on OAuth.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/65 px-4 py-5 text-xs text-slate-300 max-w-xl">
          Mirrors such as Swiss Bay host community-scanned archives. Respect every
          author&apos;s redistribution terms—this hub only stores metadata regenerated
          from public directory indexes.
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <div className="space-y-6">
          <ProfileCard />
          <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Maintainer tips
            </h2>
            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed list-disc ml-5">
              <li>
                Spawn issues in your wiki of choice—the hub stays static on purpose so
                you can host it entirely on static edge networks.
              </li>
              <li>
                Run <code className="text-[10px] text-sky-300">npm run crawl</code>{" "}
                whenever the upstream listing changes materially.
              </li>
              <li>
                Starred PDFs serialize under key{" "}
                <code className="text-emerald-200">{STAR_KEY}</code>, so clearing
                site data resets your desk.
              </li>
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Your starred corpus
              </h2>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {recentlyStarred.length} refs
              </span>
            </div>
            {recentlyStarred.length === 0 ? (
              <p className="text-xs text-slate-500">
                Flip back to Library and toggle <strong>★ Star</strong> when a PDF earns
                a spot on your whiteboard queue.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {recentlyStarred.slice(0, 40).map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block rounded-xl border border-slate-800 bg-slate-950/65 px-3 py-3 text-[13px] text-sky-300 hover:border-sky-600/70 cursor-pointer"
                    >
                      <div className="font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-[0.2em] mt-2">
                        {item.category}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Featured project spaces</h2>
            <Link
              href="/library"
              className="text-xs font-semibold text-sky-300 hover:text-white cursor-pointer"
            >
              Discover more shelves →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {ORG_FEED.map((org) => (
              <article
                key={org.name}
                className="rounded-3xl border border-slate-800 bg-slate-950/85 p-[1px] shadow-xl shadow-black/40"
              >
                <div
                  className={`rounded-[calc(1.5rem-1px)] bg-gradient-to-br ${org.accent} p-[1px]`}
                >
                  <div className="rounded-[calc(1.5rem-2px)] bg-slate-950/94 p-5 space-y-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Public desk
                    </div>
                    <h3 className="text-xl font-semibold text-white">{org.name}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{org.blurb}</p>
                    <div className="flex flex-wrap gap-2">
                      {org.stack.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] text-slate-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{org.stars}</span>
                      <Link
                        href={org.slug}
                        className="text-sky-300 hover:text-sky-100 cursor-pointer"
                      >
                        Open shelf →
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-black/40 p-6 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 max-w-xl">
                <h2 className="text-xl font-semibold text-white">
                  Contribution graph vibes, sans telemetry
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every star is synthetic until you authenticate: we render a deterministic
                  pattern so the page still exhibits that familiar activity aesthetic.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Hover each square to mimic GitHub&apos;s obsessive grid without sending
                events anywhere.
              </div>
            </div>
            <ActivityGrid accent="from-emerald-400/85 to-transparent" seed="community" />
          </section>
        </div>
      </div>
    </div>
  );
}

function ActivityGrid({ accent, seed }: { accent: string; seed: string }) {
  const grid = buildGrid(seed, 53);
  return (
    <div className="space-y-2">
      <div className="flex gap-[3px] flex-wrap opacity-95">
        {grid.map((intensity, i) => {
          const hue = accent.includes("emerald") ? "34,211,238" : "56,189,248";
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key -- deterministic mock grid positions
              key={`${seed}-${i}`}
              title={`Activity score ${Math.round(intensity * 120)}`}
              className="h-3 w-3 rounded-[2px] bg-slate-900 border border-white/10"
              style={{
                opacity: Math.max(intensity * 1.05, 0.15),
                backgroundImage: intensity
                  ? `linear-gradient(to top, rgba(${hue}, ${0.08 + intensity * 0.6}), transparent)`
                  : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="text-[11px] text-slate-500">
        Each column is faux-random salt from <code>{seed}</code>; replace with REST data
        when you wire dashboards.
      </div>
    </div>
  );
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function buildGrid(seed: string, columns: number) {
  const out: number[] = [];
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < 7; r += 1) {
      const jitter = hashString(`${seed}-${c}-${r}`) % 97;
      out.push(Math.min(1, jitter / 100));
    }
  }
  return out;
}
