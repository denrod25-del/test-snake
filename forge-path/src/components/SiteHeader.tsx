"use client";

import Link from "next/link";
import { useProgressStore } from "@/lib/progress-store";

export function SiteHeader() {
  const xp = useProgressStore((s) => s.xp);
  const streak = useProgressStore((s) => s.streak);
  const lastLessonPath = useProgressStore((s) => s.lastLessonPath);

  const nav = [
    { href: "/", label: "Home" },
    { href: "/learn", label: "Learn" },
    { href: "/library", label: "Library" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="font-semibold tracking-tight text-zinc-50 hover:text-white"
        >
          Forge Path
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span title="Experience points">
            <strong className="text-zinc-100">{xp}</strong> XP
          </span>
          <span title="Learning streak">
            🔥 <strong className="text-zinc-100">{streak}</strong>
          </span>
          {lastLessonPath ? (
            <Link
              href={lastLessonPath}
              className="rounded-full bg-violet-600/20 px-3 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-600/30"
            >
              Resume
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
