"use client";

import { useRef, useState } from "react";
import { useProgressStore } from "@/lib/progress-store";

export function SettingsPanel() {
  const exportSnapshot = useProgressStore((s) => s.exportSnapshot);
  const importSnapshot = useProgressStore((s) => s.importSnapshot);
  const reset = useProgressStore((s) => s.reset);

  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleDownload = () => {
    const snap = exportSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forge-path-progress.json";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Exported progress JSON.");
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text) as unknown;
      importSnapshot(data);
      setMessage("Imported progress from file.");
    } catch {
      setMessage("Could not read that file — needs valid JSON.");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
      <p className="text-sm text-zinc-400">
        Progress lives in your browser (localStorage). Export occasionally if
        you switch machines or clear site data.
      </p>
      {message ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5"
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Reset all Forge Path progress on this device? This cannot be undone.",
              )
            ) {
              reset();
              setMessage("Progress reset.");
            }
          }}
          className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
        >
          Reset progress
        </button>
      </div>
    </div>
  );
}
