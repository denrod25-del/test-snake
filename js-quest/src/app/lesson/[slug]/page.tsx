import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { CompleteLessonButton } from "@/components/complete-lesson-button";
import { QuizRunner } from "@/components/quiz-runner";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/profile";
import { lessonUnlocked } from "@/lib/unlock";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  await ensureProfile(session.user.id);
  const userId = session.user.id;

  const lesson = await prisma.lesson.findFirst({
    where: { slug, isAvailable: true },
  });
  if (!lesson) {
    notFound();
  }

  const allLessons = await prisma.lesson.findMany({
    where: { isAvailable: true },
    orderBy: { order: "asc" },
    select: { slug: true, order: true },
  });

  const completedRows = await prisma.userLessonProgress.findMany({
    where: { userId, completedAt: { not: null } },
    select: { lesson: { select: { slug: true } } },
  });
  const done = new Set(completedRows.map((r) => r.lesson.slug));

  if (!lessonUnlocked(slug, allLessons, done)) {
    redirect("/dashboard");
  }

  const [questions, progress] = await Promise.all([
    prisma.quizQuestion.findMany({
      where: { lessonId: lesson.id },
      orderBy: { order: "asc" },
    }),
    prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId: lesson.id },
      },
    }),
  ]);

  const quizItems = questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    choices: q.choices as unknown as string[],
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to path
          </Link>
          <span className="text-xs text-zinc-500">{lesson.chapter}</span>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {lesson.title}
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Official lesson:{" "}
          <a
            href={lesson.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400"
          >
            Read on javascript.info
          </a>
        </p>
        {lesson.summary && (
          <p className="mt-6 leading-relaxed text-zinc-700 dark:text-zinc-300">
            {lesson.summary}
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Quest status
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              Lesson cleared:{" "}
              <span className="font-medium">
                {progress?.completedAt ? "yes" : "not yet"}
              </span>
            </li>
            <li>
              Quiz best:{" "}
              <span className="font-medium">
                {progress?.quizBestScore ?? "—"}%
              </span>
            </li>
          </ul>
          <div className="mt-5">
            <CompleteLessonButton lessonSlug={lesson.slug} />
          </div>
        </div>

        {quizItems.length > 0 ? (
          <QuizRunner lessonSlug={lesson.slug} questions={quizItems} />
        ) : null}
      </article>
    </div>
  );
}
