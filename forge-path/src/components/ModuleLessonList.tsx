"use client";

import Link from "next/link";
import type { Lesson } from "@/curriculum/types";
import { useProgressStore } from "@/lib/progress-store";

type Props = {
  moduleId: string;
  lessons: Lesson[];
};

export function ModuleLessonList({ moduleId, lessons }: Props) {
  const isLessonComplete = useProgressStore((s) => s.isLessonComplete);

  return (
    <ol className="mt-10 space-y-2">
      {lessons.map((l, i) => {
        const done = isLessonComplete(moduleId, l.id);
        return (
          <li key={l.id}>
            <Link
              href={`/learn/${moduleId}/${l.id}`}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 hover:border-violet-500/40"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="font-medium text-zinc-50">{l.title}</span>
                {l.description ? (
                  <p className="mt-1 text-sm text-zinc-500">{l.description}</p>
                ) : null}
              </span>
              <span
                className={`shrink-0 text-sm ${done ? "text-emerald-400" : "text-zinc-600"}`}
                title={done ? "Completed" : "Not completed"}
              >
                {done ? "✓" : "○"}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
