"use client";

import { gameConstants } from "@/lib/game";
import { useState } from "react";

export type QuizQuestionClient = {
  id: string;
  prompt: string;
  choices: string[];
};

type QuizResultPayload = {
  scorePercent: number;
  passed: boolean;
  xpGained: number;
  explanations: {
    index: number;
    correctIndex: number;
    explanation: string;
    yours: number;
  }[];
};

export function QuizRunner({
  lessonSlug,
  questions,
}: {
  lessonSlug: string;
  questions: QuizQuestionClient[];
}) {
  const [answers, setAnswers] = useState<number[]>(() =>
    questions.map(() => -1),
  );
  const [result, setResult] = useState<QuizResultPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (answers.some((a) => a < 0)) {
      setError("Answer every question first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonSlug, answers }),
      });
      const data = (await res.json()) as { error?: string } & Record<
        string,
         unknown
       >;
      if (!res.ok) {
        setError(data.error ?? "Quiz failed");
        return;
      }
      setResult(data as QuizResultPayload);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Boss battle: quiz
        </h2>
        <span className="text-xs text-zinc-500">
          Pass at {gameConstants.QUIZ_PASS_PERCENT}%+ for bonus XP
        </span>
      </div>

      <ol className="space-y-5">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {qi + 1}. {q.prompt}
            </p>
            <div className="mt-2 space-y-2">
              {q.choices.map((c, ci) => (
                <label
                  key={ci}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1 hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={answers[qi] === ci}
                    onChange={() =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[qi] = ci;
                        return next;
                      })
                    }
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{c}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit answers"}
      </button>

      {result && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Score: {result.scorePercent}% — {result.passed ? "Passed" : "Keep practicing"}
          </p>
          {result.xpGained > 0 && (
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              +{result.xpGained} bonus XP
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {result.explanations.map((e) => (
              <li key={e.index}>
                <span className="font-medium">Q{e.index + 1}:</span>{" "}
                {e.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
