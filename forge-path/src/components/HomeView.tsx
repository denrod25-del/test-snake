"use client";

import Link from "next/link";
import {
  CURRICULUM,
  firstIncompleteLessonPath,
  overallCompletionFraction,
  moduleCompletionFraction,
} from "@/curriculum";
import { useProgressStore } from "@/lib/progress-store";

export function HomeView() {
  const isLessonComplete = useProgressStore((s) => s.isLessonComplete);
  const overall = Math.round(overallCompletionFraction(isLessonComplete) * 100);
  const resume = firstIncompleteLessonPath(isLessonComplete);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="mb-12 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Software engineering
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-50">
          Forge Path — learn full-stack foundations in small loops.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-400">
          Bite-sized lessons, quick quizzes, and a reading map. Built for
          beginners; grounded in how teams actually ship.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <span className="text-zinc-500">Course progress</span>
            <p className="text-2xl font-semibold text-zinc-50">{overall}%</p>
          </div>
          {overall >= 100 ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              You&apos;ve marked every released lesson complete. Keep building
              projects — and watch this app for new lessons.
            </p>
          ) : resume ? (
            <Link
              href={resume}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
            >
              Continue where you left off →
            </Link>
          ) : (
            <Link
              href="/learn/craft/feedback-loops"
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
            >
              Start first lesson →
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Modules
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CURRICULUM.map((m) => {
            const pct = Math.round(
              moduleCompletionFraction(m, isLessonComplete) * 100,
            );
            return (
              <li key={m.id}>
                <Link
                  href={`/learn/${m.id}`}
                  className={`flex h-full flex-col rounded-2xl border bg-gradient-to-b from-white/[0.05] to-transparent p-5 transition hover:border-white/30 hover:from-white/[0.08] ${m.accentClass}`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <h3 className="mt-3 font-semibold text-zinc-50">{m.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                    {m.description}
                  </p>
                  <p className="mt-4 text-xs font-medium text-zinc-500">
                    {pct}% complete · {m.lessons.length} lesson
                    {m.lessons.length === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
