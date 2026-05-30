"use client";

import { useEffect, useState } from "react";
import type { PdfRecord } from "@/lib/catalog";

export const STAR_KEY = "gentoomen-hub:starred-pdfs";
export const PROFILE_KEY = "gentoomen-hub:display-name";

function readStars(): StoredStar[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STAR_KEY);
    return raw ? (JSON.parse(raw) as StoredStar[]) : [];
  } catch {
    return [];
  }
}

type StoredStar = {
  url: string;
  title: string;
  category: string;
  savedAt: number;
};

function writeStars(list: StoredStar[]) {
  localStorage.setItem(STAR_KEY, JSON.stringify(list.slice(0, 400)));
  window.dispatchEvent(new Event("gentoomen-hub-star-updated"));
}

export function PdfRowActions({ pdf }: { pdf: PdfRecord }) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    function sync() {
      setStarred(readStars().some((s) => s.url === pdf.url));
    }
    sync();
    window.addEventListener("gentoomen-hub-star-updated", sync);
    return () => window.removeEventListener("gentoomen-hub-star-updated", sync);
  }, [pdf.url]);

  function toggle() {
    const list = readStars();
    const idx = list.findIndex((s) => s.url === pdf.url);
    if (idx === -1) {
      list.unshift({
        url: pdf.url,
        title: pdf.title,
        category: pdf.topCategory,
        savedAt: Date.now(),
      });
      writeStars(list);
      setStarred(true);
      return;
    }
    list.splice(idx, 1);
    writeStars(list);
    setStarred(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={pdf.url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center rounded-lg bg-sky-500/90 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 cursor-pointer"
      >
        Open PDF
      </a>
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
          starred
            ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
            : "border-slate-700 text-slate-300 hover:border-emerald-500/50"
        }`}
        aria-pressed={starred}
      >
        {starred ? "★ Starred" : "☆ Star"}
      </button>
    </div>
  );
}

export function useStarredList() {
  const [items, setItems] = useState<StoredStar[]>([]);

  useEffect(() => {
    function sync() {
      setItems(readStars());
    }
    sync();
    window.addEventListener("gentoomen-hub-star-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gentoomen-hub-star-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return items;
}

export function ProfileCard() {
  const [name, setName] = useState("");
  useEffect(() => {
    setName(localStorage.getItem(PROFILE_KEY) ?? "");
    function sync() {
      setName(localStorage.getItem(PROFILE_KEY) ?? "");
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function persist(next: string) {
    localStorage.setItem(PROFILE_KEY, next.slice(0, 60));
    setName(next.slice(0, 60));
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Your handle
      </h2>
      <p className="text-xs text-slate-400">
        Lightweight GitHub vibes without accounts—everything stays in this browser.
      </p>
      <label className="block text-[11px] text-slate-500" htmlFor="handle">
        Display name (local-only)
      </label>
      <input
        id="handle"
        value={name}
        onChange={(e) => persist(e.target.value)}
        placeholder="e.g., kernel-friend"
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
      />
    </section>
  );
}
