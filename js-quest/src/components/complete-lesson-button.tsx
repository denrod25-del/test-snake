"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteLessonButton({ lessonSlug }: { lessonSlug: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonSlug, action: "complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Could not save progress");
        return;
      }
      setMsg(
        data.alreadyComplete
          ? "Already completed — streak updated."
          : `+${data.xpGained} XP — lesson cleared!`,
      );
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={complete}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark lesson complete"}
      </button>
      {msg && <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p>}
    </div>
  );
}
