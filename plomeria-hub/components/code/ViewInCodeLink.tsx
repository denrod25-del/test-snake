/**
 * @bsymbolic — Plomería Hub integration
 * components/ViewInCodeLink.tsx
 *
 * Inline cross-link from a Plomería Hub practice question rationale
 * (or any reference to a code section) to the public reference at
 * code.bsymbolic.com. The href includes ?ref=ph for attribution so
 * code-search analytics can see incoming traffic from the paid
 * product.
 *
 * Server component — no client JS required. Renders as a normal link.
 */

import { SECTIONS, type Lang } from "@bsymbolic/fbc-data";

const CODE_SITE = process.env.NEXT_PUBLIC_CODE_SITE_URL ?? "https://code.bsymbolic.com";

interface Props {
  sectionId: string;
  lang?: Lang;
  /** Override the visible link label. Defaults to "FBC-P {section}". */
  label?: string;
}

export function ViewInCodeLink({ sectionId, lang = "es", label }: Props) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) {
    return (
      <span className="font-mono text-sm text-zinc-500">
        FBC-P {sectionId}
      </span>
    );
  }

  const href = `${CODE_SITE}/section/${section.id}?ref=ph`;
  const text =
    label ??
    `${lang === "es" ? "FBC-P" : "FBC-P"} ${section.section} — ${section.title[lang]}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-sm text-amber-700 hover:text-amber-900 underline underline-offset-2 decoration-zinc-300 hover:decoration-amber-700"
    >
      {text}
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17 17 7M7 7h10v10" />
      </svg>
    </a>
  );
}
