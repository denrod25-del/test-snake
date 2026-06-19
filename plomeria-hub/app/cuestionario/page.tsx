import Link from "next/link";
import { SECTIONS, type Lang } from "@bsymbolic/fbc-data";
import { ViewInCodeLink } from "@/components/code/ViewInCodeLink";

const LANG: Lang = "es";

interface PageProps {
  searchParams: { source?: string };
}

/**
 * Minimal quiz surface. The integration kit's PracticeForSection links
 * here with ?source=<sectionId>; a full Plomería Hub would filter its
 * question pool to questions tagged with that section. This stub shows
 * the filter is wired and cross-links back to the public reference.
 */
export default function CuestionarioPage({ searchParams }: PageProps) {
  const source = searchParams.source ? decodeURIComponent(searchParams.source) : null;
  const section = source ? SECTIONS.find((s) => s.id === source) : null;

  return (
    <div>
      <div className="font-mono text-xs text-amber-700 tracking-wider mb-2">
        CUESTIONARIO
      </div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900">
        Práctica
      </h1>

      {section ? (
        <div className="mt-6 p-6 border border-zinc-300 bg-white">
          <p className="font-sans text-base text-zinc-800 leading-relaxed">
            Preguntas filtradas para{" "}
            <strong>
              FBC-P {section.section} — {section.title[LANG]}
            </strong>
            .
          </p>
          <p className="mt-4 font-sans text-sm text-zinc-600 leading-relaxed">
            Repasa la referencia pública:{" "}
            <ViewInCodeLink sectionId={section.id} lang={LANG} />
          </p>
          <Link
            href={`/codigo/${encodeURIComponent(section.id)}`}
            className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-amber-700 hover:text-amber-900"
          >
            ← Volver a la sección
          </Link>
        </div>
      ) : (
        <p className="mt-6 font-sans text-base text-zinc-600 leading-relaxed">
          Elige una sección del{" "}
          <Link href="/" className="text-amber-700 underline underline-offset-2">
            índice del código
          </Link>{" "}
          y usa “Practica esta sección” para empezar.
        </p>
      )}
    </div>
  );
}
