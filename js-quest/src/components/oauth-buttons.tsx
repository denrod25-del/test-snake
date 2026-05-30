"use client";

import { signIn } from "next-auth/react";

type Props = { callbackUrl?: string };

export function OAuthButtons({ callbackUrl = "/dashboard" }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl })}
        className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Continue with GitHub
      </button>
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        Continue with Google
      </button>
    </div>
  );
}
