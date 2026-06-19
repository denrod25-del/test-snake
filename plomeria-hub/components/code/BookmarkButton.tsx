"use client";

/**
 * @bsymbolic — Plomería Hub integration
 * components/BookmarkButton.tsx
 *
 * Client component. Optimistic bookmark toggle backed by a server
 * action. Reverts state on failure.
 */

import { useState, useTransition } from "react";
import { toggleCodeBookmarkAction } from "./actions";

interface Props {
  sectionId: string;
  initialBookmarked: boolean;
  lang: "en" | "es";
}

export function BookmarkButton({ sectionId, initialBookmarked, lang }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    const next = !bookmarked;
    // Optimistic update
    setBookmarked(next);
    startTransition(async () => {
      const result = await toggleCodeBookmarkAction(sectionId);
      if (!result.ok) {
        // Revert
        setBookmarked(!next);
        console.error("Bookmark toggle failed:", result.error);
      } else if (typeof result.data === "boolean") {
        // Reconcile with server's authoritative answer
        setBookmarked(result.data);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors",
        bookmarked
          ? "border-amber-700 bg-amber-50 text-amber-800"
          : "border-zinc-300 hover:border-zinc-900 text-zinc-700",
        pending ? "opacity-60" : "",
      ].join(" ")}
      aria-label={
        bookmarked
          ? lang === "es"
            ? "Quitar marcador"
            : "Remove bookmark"
          : lang === "es"
            ? "Agregar marcador"
            : "Add bookmark"
      }
      aria-pressed={bookmarked}
    >
      <BookmarkIcon filled={bookmarked} />
      {bookmarked
        ? lang === "es"
          ? "Marcada"
          : "Bookmarked"
        : lang === "es"
          ? "Marcar"
          : "Bookmark"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
