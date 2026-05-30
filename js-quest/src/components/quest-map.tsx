import Link from "next/link";
import { lessonUnlocked } from "@/lib/unlock";

export type LessonSummary = {
  id: string;
  slug: string;
  title: string;
  part: number;
  chapter: string;
  order: number;
  officialUrl: string;
  summary: string | null;
};

type ProgressLookup = {
  completedAt: string | null;
  quizBestScore: number | null;
};

export function QuestMap({
  lessons,
  progressBySlug,
}: {
  lessons: LessonSummary[];
  progressBySlug: Record<string, ProgressLookup | undefined>;
}) {
  const completedSlugs = new Set(
    Object.entries(progressBySlug)
      .filter(([, v]) => v?.completedAt)
      .map(([slug]) => slug),
  );

  const byChapter = lessons.reduce<Record<string, LessonSummary[]>>((acc, l) => {
    acc[l.chapter] = acc[l.chapter] ?? [];
    acc[l.chapter].push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {Object.entries(byChapter).map(([chapter, rows]) => (
        <section key={chapter}>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {chapter}
          </h2>
          <ol className="space-y-3">
            {rows
              .sort((a, b) => a.order - b.order)
              .map((lesson) => {
                const prog = progressBySlug[lesson.slug];
                const done = !!prog?.completedAt;
                const open = lessonUnlocked(lesson.slug, lessons, completedSlugs);
                return (
                  <li key={lesson.slug}>
                    <div
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                        open
                          ? "border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-400/30"
                          : "border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {lesson.title}
                          </span>
                          {!open && (
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                              Locked
                            </span>
                          )}
                          {done && (
                            <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                              Cleared
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          Quiz best: {prog?.quizBestScore ?? "—"}%
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {open ? (
                          <Link
                            href={`/lesson/${lesson.slug}`}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                          >
                            Enter quest
                          </Link>
                        ) : (
                          <span className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
}
