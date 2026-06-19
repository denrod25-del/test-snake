import Link from "next/link";
import type { Metadata } from "next";
import { SECTIONS, type Lang } from "@bsymbolic/fbc-data";
import { CodeReferencePanel } from "@/components/code/CodeReferencePanel";
import { PracticeForSection } from "@/components/code/PracticeForSection";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const LANG: Lang = "es";

interface PageProps {
  params: { seccion: string };
}

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ seccion: s.id }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const section = SECTIONS.find((s) => s.id === decodeURIComponent(params.seccion));
  if (!section) return { title: "Sección no encontrada — Plomería Hub" };
  return { title: `FBC-P ${section.section} — ${section.title[LANG]} · Plomería Hub` };
}

/**
 * Resolve a Supabase client only when there's an authenticated user.
 * The kit's CodeReferencePanel renders anonymously when passed null, so
 * the page works with or without Supabase configured.
 */
async function getAuthedSupabase(): Promise<SupabaseClient | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? supabase : null;
  } catch {
    return null;
  }
}

export default async function CodigoPage({ params }: PageProps) {
  const sectionId = decodeURIComponent(params.seccion);
  const supabase = await getAuthedSupabase();

  return (
    <div>
      <Link
        href="/"
        className="inline-block mb-6 font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-amber-700"
      >
        ← Todas las secciones
      </Link>

      <CodeReferencePanel sectionId={sectionId} lang={LANG} supabase={supabase} />

      <PracticeForSection sectionId={sectionId} lang={LANG} questionCount={5} />
    </div>
  );
}
