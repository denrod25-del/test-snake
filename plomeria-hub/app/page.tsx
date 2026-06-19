import Link from "next/link";
import { SECTIONS, type Lang } from "@bsymbolic/fbc-data";

const LANG: Lang = "es";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <div className="font-mono text-xs text-amber-700 tracking-wider mb-2">
          CÓDIGO DE PLOMERÍA DE FLORIDA
        </div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900">
          Secciones del Código (FBC-P)
        </h1>
        <p className="mt-3 font-sans text-base text-zinc-600 max-w-2xl leading-relaxed">
          Referencia bilingüe del Código de Construcción de Florida — Plomería.
          Los suscriptores obtienen notas personales y marcadores sincronizados
          en todos sus dispositivos.
        </p>
      </div>

      <ul className="divide-y divide-zinc-200 border border-zinc-300 bg-white">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={`/codigo/${encodeURIComponent(section.id)}`}
              className="flex items-baseline gap-4 px-6 py-4 hover:bg-amber-50 transition-colors group"
            >
              <span className="font-mono text-sm text-amber-700 w-16 shrink-0">
                {section.section}
              </span>
              <span className="font-sans text-base text-zinc-900 group-hover:text-amber-900">
                {section.title[LANG]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
