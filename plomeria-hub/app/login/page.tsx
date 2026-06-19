"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/"
        className="inline-block mb-6 font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-amber-700"
      >
        ← Inicio
      </Link>

      <div className="font-mono text-xs text-amber-700 tracking-wider mb-2">
        ACCESO DE SUSCRIPTORES
      </div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-900">
        Iniciar sesión
      </h1>
      <p className="mt-3 font-sans text-base text-zinc-600 leading-relaxed">
        Te enviamos un enlace mágico por correo. Al iniciar sesión, tus notas y
        marcadores se sincronizan en todos tus dispositivos.
      </p>

      {!isSupabaseConfigured ? (
        <div className="mt-6 p-4 border border-amber-300 bg-amber-50 font-sans text-sm text-amber-900 leading-relaxed">
          La autenticación aún no está configurada en este despliegue. Define{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en las
          variables de entorno para habilitar el inicio de sesión.
        </div>
      ) : status === "sent" ? (
        <div className="mt-6 p-4 border border-emerald-300 bg-emerald-50 font-sans text-sm text-emerald-900 leading-relaxed">
          ✓ Revisa <strong>{email}</strong>. Te enviamos un enlace para iniciar
          sesión. Ábrelo en este dispositivo.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            className="w-full p-3 border border-zinc-300 bg-white text-zinc-900 font-sans text-sm focus:outline-none focus:border-zinc-900"
            aria-label="Correo electrónico"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full px-4 py-3 border border-amber-700 bg-amber-700 text-white font-mono text-xs uppercase tracking-wider hover:bg-amber-800 disabled:opacity-60"
          >
            {status === "sending" ? "Enviando..." : "Enviar enlace mágico"}
          </button>
          {status === "error" && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-red-700">
              ⚠ {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
