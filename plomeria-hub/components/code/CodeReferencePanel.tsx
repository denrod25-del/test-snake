/**
 * @bsymbolic — Plomería Hub integration
 * components/CodeReferencePanel.tsx
 *
 * Server component. Renders a single FBC-P section with the logged-in
 * user's personal note (Supabase-synced) and bookmark state attached.
 *
 * Drop this onto any Plomería Hub page that wants to display a code
 * section — e.g. a practice question's "source code" expansion, or
 * a dedicated /codigo/[seccion] route.
 *
 * Falls back to an anonymous render (no notes UI, no bookmark) when
 * no user is authenticated.
 */

import { SECTIONS, type Lang, type Section } from "@bsymbolic/fbc-data";
import { getCodeNote, listCodeBookmarks } from "@/lib/code-notes";
import { CodeNotesEditor } from "./CodeNotesEditor";
import { BookmarkButton } from "./BookmarkButton";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  /** FBC-P section identifier (e.g. "909.1") */
  sectionId: string;
  /** Display language */
  lang?: Lang;
  /**
   * Supabase server client constructed by the consumer (Plomería Hub
   * already has its own SSR client factory). When null, panel renders
   * in anonymous mode without notes / bookmark UI.
   */
  supabase: SupabaseClient | null;
}

export async function CodeReferencePanel({
  sectionId,
  lang = "es",
  supabase,
}: Props) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) {
    return (
      <div className="p-6 border border-zinc-300 text-zinc-600 text-sm">
        Section <code>{sectionId}</code> not found in the FBC-P dataset.
      </div>
    );
  }

  // Anonymous render (no user)
  if (!supabase) {
    return <SectionContent section={section} lang={lang} />;
  }

  // Authenticated render — load note + bookmark state in parallel
  const [existingNote, bookmarks] = await Promise.all([
    safeGetNote(supabase, sectionId),
    safeGetBookmarks(supabase),
  ]);

  const isBookmarked = bookmarks?.has(sectionId) ?? false;

  return (
    <article className="border border-zinc-300 bg-white">
      <header className="flex items-start justify-between gap-4 p-6 border-b border-zinc-200">
        <div>
          <div className="font-mono text-xs text-amber-700 tracking-wider mb-1">
            FBC-P {section.section}
          </div>
          <h2 className="font-display text-2xl font-medium text-zinc-900 leading-tight tracking-tight">
            {section.title[lang]}
          </h2>
        </div>
        <BookmarkButton
          sectionId={sectionId}
          initialBookmarked={isBookmarked}
          lang={lang}
        />
      </header>

      <SectionContent section={section} lang={lang} compact />

      <div className="px-6 py-5 border-t border-zinc-200 bg-zinc-50">
        <CodeNotesEditor
          sectionId={sectionId}
          initialContent={existingNote?.content ?? ""}
          lang={lang}
        />
      </div>
    </article>
  );
}

/* ============================================================
   Safe wrappers — never throw out of a server component.
   A failed note fetch shouldn't kill the whole page.
============================================================ */

async function safeGetNote(supabase: SupabaseClient, sectionId: string) {
  try {
    return await getCodeNote(supabase, sectionId);
  } catch (err) {
    console.error("CodeReferencePanel: getCodeNote failed", err);
    return null;
  }
}

async function safeGetBookmarks(supabase: SupabaseClient) {
  try {
    return await listCodeBookmarks(supabase);
  } catch (err) {
    console.error("CodeReferencePanel: listCodeBookmarks failed", err);
    return null;
  }
}

/* ============================================================
   Section content (presentation only — server-rendered)
============================================================ */

interface ContentProps {
  section: Section;
  lang: Lang;
  /** When true, suppress the title block (parent rendered the header) */
  compact?: boolean;
}

function SectionContent({ section, lang, compact = false }: ContentProps) {
  return (
    <div className="p-6 space-y-6">
      {!compact && (
        <div>
          <div className="font-mono text-xs text-amber-700 tracking-wider mb-1">
            FBC-P {section.section}
          </div>
          <h2 className="font-display text-2xl font-medium text-zinc-900 leading-tight tracking-tight">
            {section.title[lang]}
          </h2>
        </div>
      )}

      <Block label={lang === "es" ? "Resumen del Código" : "Code Summary"}>
        {section.codeSummary[lang]}
      </Block>

      <Block label={lang === "es" ? "En Lenguaje Sencillo" : "Plain English"}>
        {section.plainEnglish[lang]}
      </Block>

      <Block label={lang === "es" ? "Notas de Campo" : "Field Notes"}>
        {section.fieldNotes[lang]}
      </Block>

      {section.florida && (
        <Block
          label={lang === "es" ? "Específico de Florida" : "Florida-Specific"}
          accent
        >
          {section.florida[lang]}
        </Block>
      )}
    </div>
  );
}

function Block({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section>
      <h3
        className={[
          "font-mono text-[11px] uppercase tracking-[0.16em] font-semibold mb-2",
          accent ? "text-amber-700" : "text-zinc-500",
        ].join(" ")}
      >
        {label}
      </h3>
      <p className="font-sans text-base text-zinc-800 leading-relaxed">
        {children}
      </p>
    </section>
  );
}
