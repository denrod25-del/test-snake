"use client";

import { useTransition } from "react";
import { approveComment, rejectComment } from "./actions";

type Props = { commentId: string };

export function ModerationButtons({ commentId }: Props) {
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => approveComment(commentId))}
        className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => rejectComment(commentId))}
        className="rounded-md border border-zinc-400 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-900"
      >
        Reject
      </button>
    </div>
  );
}
