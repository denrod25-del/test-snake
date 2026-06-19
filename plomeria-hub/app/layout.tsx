import type { Metadata } from "next";
import { ConversionAttribution } from "@/components/code/ConversionAttribution";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plomería Hub — Código de Plomería de Florida",
  description:
    "Referencia del Código de Plomería de Florida (FBC-P) en español e inglés, con notas y marcadores sincronizados para suscriptores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">
        {/* Captures ?ref=code&seccion=... from code.bsymbolic.com traffic */}
        <ConversionAttribution />
        <header className="border-b border-zinc-300 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-4 flex items-baseline justify-between">
            <a href="/" className="font-display text-xl font-semibold tracking-tight">
              Plomería<span className="text-amber-700">Hub</span>
            </a>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              FBC-P · Florida
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
        <footer className="border-t border-zinc-300 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-6 font-sans text-xs text-zinc-500 leading-relaxed">
            Contenido de referencia del Código de Construcción de Florida —
            Plomería. Verifica siempre contra la edición vigente adoptada antes
            de una instalación o inspección real.
          </div>
        </footer>
      </body>
    </html>
  );
}
