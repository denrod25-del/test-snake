"use client";

/**
 * @bsymbolic — Plomería Hub integration
 * components/CodeNotesEditor.tsx
 *
 * Client component. Renders a textarea for the user's personal note
 * on a code section. Autosaves to Supabase via server action after
 * 500ms of inactivity. Shows a brief "Saved" indicator on success.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCodeNoteAction } from "./actions";

const SAVE_DELAY_MS = 500;

interface Props {
  sectionId: string;
  initialContent: string;
  lang: "en" | "es";
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function CodeNotesEditor({ sectionId, initialContent, lang }: Props) {
  const [text, setText] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the user has actually typed, to suppress autosave
  // on first mount when state echoes the server-provided initialContent.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setState("saving");
    setError(null);

    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await saveCodeNoteAction(sectionId, text);
        if (result.ok) {
          setState("saved");
          // Fade the indicator back to idle after a beat
          setTimeout(() => setState("idle"), 1500);
        } else {
          setState("error");
          setError(result.error ?? "Save failed");
        }
      });
    }, SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, sectionId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
          {lang === "es" ? "Tus Notas" : "Your Notes"}
        </h3>
        <StatusIndicator state={state} error={error} lang={lang} />
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          dirtyRef.current = true;
          setText(e.target.value);
        }}
        placeholder={
          lang === "es"
            ? "Tus notas se guardan automáticamente y sincronizan en todos tus dispositivos."
            : "Your notes save automatically and sync across all your devices."
        }
        rows={4}
        maxLength={16384}
        className="w-full p-3 border border-zinc-300 bg-white text-zinc-900 font-sans text-sm leading-relaxed resize-vertical focus:outline-none focus:border-zinc-900"
        aria-label="Personal notes"
      />
    </div>
  );
}

function StatusIndicator({
  state,
  error,
  lang,
}: {
  state: SaveState;
  error: string | null;
  lang: "en" | "es";
}) {
  if (state === "saving") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
        {lang === "es" ? "Guardando..." : "Saving..."}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-700">
        ✓ {lang === "es" ? "Guardado" : "Saved"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-red-700"
        title={error ?? undefined}
      >
        ⚠ {lang === "es" ? "Error al guardar" : "Save failed"}
      </span>
    );
  }
  return null;
}
