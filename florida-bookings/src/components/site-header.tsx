"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SignInOut } from "@/components/sign-in-out";

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            FL Bookings
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/records" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Records
            </Link>
            {session?.user ? (
              <Link href="/admin/comments" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Moderation
              </Link>
            ) : null}
          </nav>
        </div>
        {status === "loading" ? (
          <span className="text-sm text-zinc-500">…</span>
        ) : (
          <SignInOut session={session ?? null} />
        )}
      </div>
    </header>
  );
}
