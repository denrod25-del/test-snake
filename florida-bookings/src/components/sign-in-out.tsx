"use client";

import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";

type Props = {
  session: Session | null;
};

export function SignInOut({ session }: Props) {
  if (session?.user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="max-w-[10rem] truncate text-zinc-600 dark:text-zinc-400" title={session.user.email ?? ""}>
          {session.user.email ?? session.user.name ?? "Signed in"}
        </span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/records" })}
          className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn(undefined, { callbackUrl: "/records" })}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Sign in to comment
    </button>
  );
}
