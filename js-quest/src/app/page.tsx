import Link from "next/link";
import { auth } from "@/auth";
import { OAuthButtons } from "@/components/oauth-buttons";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-tight">JS Quest</span>
          {session?.user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Open dashboard
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-16">
        <div className="space-y-4">
          <p className="inline-flex rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Gamified companion · Part 1 seeds
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Turn the{" "}
            <a
              href="https://javascript.info/"
              className="text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-500 dark:text-indigo-400"
            >
              javascript.info
            </a>{" "}
            path into a quest.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Read the official lessons (we link out—no copying their text), tick
            objectives, beat quizzes for bonus XP, and keep a streak. v1 covers
            the Introduction + JavaScript Fundamentals map; more chapters can be
            added as seeds.
          </p>
        </div>

        {!session?.user ? (
          <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Sign in to save progress
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Configure GitHub or Google OAuth in <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">.env</code>
              , then continue.
            </p>
            <OAuthButtons />
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Continue your quest
            </Link>
          </div>
        )}

        <footer className="mt-auto border-t border-zinc-200 pt-8 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          Curriculum structure aligns with the public tutorial map at{" "}
          <a href="https://javascript.info/" className="underline">
            javascript.info
          </a>
          . Lesson text stays there; quizzes and summaries here are original.
        </footer>
      </main>
    </div>
  );
}
