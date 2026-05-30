"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/curriculum/types";
import {
  blankMatches,
  shuffledOrder,
} from "@/lib/drills";
import { useProgressStore } from "@/lib/progress-store";

type Props = {
  moduleId: string;
  lesson: Lesson;
  nextPath: string | null;
  prevPath: string | null;
};

export function LessonRunner({ moduleId, lesson, nextPath, prevPath }: Props) {
  const lessonId = lesson.id;
  const path = `/learn/${moduleId}/${lessonId}`;

  const completeLesson = useProgressStore((s) => s.completeLesson);
  const claimQuizBonus = useProgressStore((s) => s.claimQuizBonus);
  const isLessonComplete = useProgressStore((s) => s.isLessonComplete);
  const setLastLessonPath = useProgressStore((s) => s.setLastLessonPath);
  const touchStreak = useProgressStore((s) => s.touchStreak);

  const [choices, setChoices] = useState<Record<number, number | null>>({});
  const [fillValues, setFillValues] = useState<Record<string, string>>({});

  const [reorderByBlock, setReorderByBlock] = useState<
    Record<number, number[]>
  >(() => {
    const init: Record<number, number[]> = {};
    lesson.blocks.forEach((b, i) => {
      if (b.type === "drill-reorder") {
        init[i] = shuffledOrder(b.correctOrder).order;
      }
    });
    return init;
  });

  useEffect(() => {
    setLastLessonPath(path);
    touchStreak();
  }, [path, setLastLessonPath, touchStreak]);

  const allQuizzesCorrect = useMemo(() => {
    for (let i = 0; i < lesson.blocks.length; i++) {
      const b = lesson.blocks[i];
      if (b.type !== "quiz") continue;
      if (choices[i] !== b.answer) return false;
    }
    return true;
  }, [choices, lesson.blocks]);

  const allFillsCorrect = useMemo(() => {
    for (let i = 0; i < lesson.blocks.length; i++) {
      const b = lesson.blocks[i];
      if (b.type !== "drill-fill") {
        continue;
      }
      let blankIdx = 0;
      for (const part of b.parts) {
        if (typeof part === "string") continue;
        const key = `${i}-${blankIdx}`;
        const val = fillValues[key] ?? "";
        if (!blankMatches(val, part)) return false;
        blankIdx++;
      }
    }
    return true;
  }, [fillValues, lesson.blocks]);

  const allReordersCorrect = useMemo(() => {
    for (let i = 0; i < lesson.blocks.length; i++) {
      const b = lesson.blocks[i];
      if (b.type !== "drill-reorder") continue;
      const user = reorderByBlock[i];
      if (!user || user.length !== b.correctOrder.length) return false;
      if (!user.every((v, j) => v === b.correctOrder[j])) return false;
    }
    return true;
  }, [lesson.blocks, reorderByBlock]);

  const canComplete =
    allQuizzesCorrect && allFillsCorrect && allReordersCorrect;

  const handleSelectQuiz = (blockIndex: number, optionIndex: number) => {
    const block = lesson.blocks[blockIndex];
    if (block.type !== "quiz") return;
    setChoices((c) => ({ ...c, [blockIndex]: optionIndex }));
    if (optionIndex === block.answer) {
      claimQuizBonus(moduleId, lessonId);
    }
  };

  const swapReorder = (blockIndex: number, a: number, b: number) => {
    setReorderByBlock((prev) => {
      const cur = [...(prev[blockIndex] ?? [])];
      [cur[a], cur[b]] = [cur[b], cur[a]];
      return { ...prev, [blockIndex]: cur };
    });
  };

  const done = isLessonComplete(moduleId, lessonId);

  const completeHint = !allQuizzesCorrect
    ? "Answer every quiz correctly."
    : !allFillsCorrect
      ? "Complete all fill-in-the-blank drills."
      : !allReordersCorrect
        ? "Put every reorder drill in the right sequence."
        : undefined;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-10 space-y-2 border-b border-white/10 pb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Lesson
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          {lesson.title}
        </h1>
        {lesson.description ? (
          <p className="text-zinc-400">{lesson.description}</p>
        ) : null}
      </header>

      <div className="space-y-8">
        {lesson.blocks.map((block, i) => {
          if (block.type === "text") {
            return (
              <div
                key={i}
                className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:tracking-tight"
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            );
          }
          if (block.type === "callout") {
            const border =
              block.tone === "tip"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-amber-500/40 bg-amber-500/5";
            return (
              <aside
                key={i}
                className={`rounded-xl border px-4 py-3 ${border}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {block.label}
                </p>
                <div
                  className="mt-2 text-sm text-zinc-200 [&_em]:text-zinc-100"
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              </aside>
            );
          }
          if (block.type === "quiz") {
            const picked = choices[i];
            const correct = picked === block.answer;
            const showResult = picked !== null && picked !== undefined;
            return (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="font-medium text-zinc-100">{block.q}</p>
                <ul className="mt-4 space-y-2">
                  {block.options.map((opt, j) => {
                    const active = picked === j;
                    return (
                      <li key={j}>
                        <button
                          type="button"
                          onClick={() => handleSelectQuiz(i, j)}
                          className={`flex w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            active
                              ? "border-violet-400/80 bg-violet-500/10 text-zinc-50"
                              : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                          }`}
                        >
                          {opt}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {showResult ? (
                  <p
                    className={`mt-4 text-sm ${correct ? "text-emerald-400" : "text-amber-300"}`}
                  >
                    {correct ? "Nice — that's right." : `Not quite — ${block.why}`}
                  </p>
                ) : null}
              </div>
            );
          }
          if (block.type === "reading") {
            return (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Read next
                </p>
                <a
                  href={block.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-medium text-sky-400 underline-offset-4 hover:underline"
                >
                  {block.title}
                </a>
                {block.note ? (
                  <p className="text-sm text-zinc-400">{block.note}</p>
                ) : null}
              </div>
            );
          }
          if (block.type === "drill-fill") {
            let blankIdx = 0;
            return (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                  Fill in
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-base leading-relaxed text-zinc-200">
                  {block.parts.map((part, pi) => {
                    if (typeof part === "string") {
                      return (
                        <span key={pi} dangerouslySetInnerHTML={{ __html: part }} />
                      );
                    }
                    const bKey = `${i}-${blankIdx}`;
                    const current = fillValues[bKey] ?? "";
                    const ok = current.length > 0 && blankMatches(current, part);
                    blankIdx++;
                    return (
                      <input
                        key={pi}
                        aria-label={`Blank ${blankIdx}`}
                        value={current}
                        onChange={(e) =>
                          setFillValues((f) => ({
                            ...f,
                            [bKey]: e.target.value,
                          }))
                        }
                        className={`mx-0.5 w-28 rounded border bg-zinc-900 px-2 py-1 text-sm outline-none ring-violet-500/30 focus:ring-2 sm:w-36 ${
                          ok
                            ? "border-emerald-500/50"
                            : "border-white/20"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          }
          if (block.type === "drill-reorder") {
            const order = reorderByBlock[i] ?? block.correctOrder;
            const correct = order.every(
              (v, j) => v === block.correctOrder[j],
            );
            return (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                  Reorder steps
                </p>
                {block.intro ? (
                  <p className="mt-2 text-sm text-zinc-400">{block.intro}</p>
                ) : null}
                <ol className="mt-4 space-y-2">
                  {order.map((lineIdx, pos) => (
                    <li
                      key={`${lineIdx}-${pos}`}
                      className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                    >
                      <span className="mt-0.5 w-6 shrink-0 text-right text-xs text-zinc-500">
                        {pos + 1}.
                      </span>
                      <span className="flex-1 text-sm text-zinc-200">
                        {block.lines[lineIdx]}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={pos === 0}
                          onClick={() => swapReorder(i, pos - 1, pos)}
                          className="rounded border border-white/15 px-2 py-1 text-xs text-zinc-300 disabled:opacity-30 hover:bg-white/5"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={pos === order.length - 1}
                          onClick={() => swapReorder(i, pos, pos + 1)}
                          className="rounded border border-white/15 px-2 py-1 text-xs text-zinc-300 disabled:opacity-30 hover:bg-white/5"
                        >
                          Down
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
                {correct ? (
                  <p className="mt-3 text-sm text-emerald-400">Order locked in.</p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    Use Up/Down until the flow matches how you would build it.
                  </p>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>

      <footer className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          {prevPath ? (
            <Link
              href={prevPath}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
            >
              ← Previous
            </Link>
          ) : null}
          {nextPath ? (
            <Link
              href={nextPath}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
            >
              Next →
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          disabled={done || !canComplete}
          onClick={() => completeLesson(moduleId, lessonId)}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          title={completeHint}
        >
          {done ? "Lesson complete" : "Mark lesson complete"}
        </button>
      </footer>
    </article>
  );
}
