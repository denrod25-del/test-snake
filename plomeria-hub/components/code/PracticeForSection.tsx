/**
 * @bsymbolic — Plomería Hub integration
 * components/PracticeForSection.tsx
 *
 * Server component. Renders a CTA card linking a code section page
 * to the corresponding practice quiz in Plomería Hub.
 *
 * Use on any code-reference page in PH to surface the study path:
 * "You just read 909.1 — now drill 5 practice questions for it."
 *
 * Assumes PH's quiz route accepts a `?source=<sectionId>` filter to
 * scope questions to those tagged with the section. Adjust the path
 * if your quiz route differs.
 */

import { SECTIONS, type Lang } from "@bsymbolic/fbc-data";
import Link from "next/link";

interface Props {
  sectionId: string;
  lang?: Lang;
  /** Quiz path on Plomería Hub. Default: /cuestionario */
  quizPath?: string;
  /** Approximate question count to show in the CTA. */
  questionCount?: number;
}

export function PracticeForSection({
  sectionId,
  lang = "es",
  quizPath = "/cuestionario",
  questionCount = 5,
}: Props) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;

  const href = `${quizPath}?source=${encodeURIComponent(section.id)}`;

  return (
    <Link
      href={href}
      className="block mt-8 p-6 border border-amber-200 bg-amber-50 hover:border-amber-700 transition-colors group"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800 mb-2 font-semibold">
        {lang === "es" ? "Practica esta sección" : "Practice this section"}
      </div>
      <p className="font-sans text-sm text-zinc-800 leading-relaxed mb-3 max-w-xl">
        {lang === "es"
          ? `Refuerza FBC-P ${section.section} con ${questionCount} preguntas de estilo CPC.`
          : `Drill FBC-P ${section.section} with ${questionCount} CPC-style questions.`}
      </p>
      <span className="inline-flex items-center gap-1 font-mono text-sm text-amber-800 group-hover:text-amber-900 underline underline-offset-4 decoration-amber-300">
        {lang === "es" ? "Iniciar práctica" : "Start practice"} →
      </span>
    </Link>
  );
}
