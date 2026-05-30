import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/profile";
import { QuestMap } from "@/components/quest-map";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  await ensureProfile(session.user.id);

  const [profile, lessons, progressRows] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.lesson.findMany({
      where: { isAvailable: true },
      orderBy: { order: "asc" },
    }),
    prisma.userLessonProgress.findMany({
      where: { userId: session.user.id },
      include: { lesson: { select: { slug: true } } },
    }),
  ]);

  const progressBySlug: Record<
    string,
    { completedAt: string | null; quizBestScore: number | null }
  > = {};

  for (const row of progressRows) {
    progressBySlug[row.lesson.slug] = {
      completedAt: row.completedAt?.toISOString() ?? null,
      quizBestScore: row.quizBestScore,
    };
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              JS Quest
            </Link>
            <p className="text-xs text-zinc-500">
              Logged in as {session.user.name ?? session.user.email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <Stat label="Level" value={String(profile?.level ?? 1)} />
          <Stat label="XP" value={String(profile?.xp ?? 0)} />
          <Stat
            label="Streak"
            value={`${profile?.streakCount ?? 0} day${(profile?.streakCount ?? 0) === 1 ? "" : "s"}`}
          />
        </div>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your path
        </h1>
        <QuestMap lessons={lessons} progressBySlug={progressBySlug} />
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
