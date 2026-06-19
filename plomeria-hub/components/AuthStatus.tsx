"use client";

/**
 * Header auth control. Shows a sign-in link when logged out, or the
 * user's email + sign-out when logged in. Lives in the (static) layout
 * as a client component so it doesn't force dynamic rendering on every
 * page; it reconciles auth state on the client and calls router.refresh()
 * after sign-out so server-rendered notes/bookmarks disappear.
 *
 * Renders nothing when Supabase isn't configured.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthStatus() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setEmail(null);
    router.refresh();
  }

  if (!isSupabaseConfigured || !ready) return null;

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-zinc-500 hidden sm:inline">
          {email}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 hover:text-amber-700"
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="font-mono text-[11px] uppercase tracking-wider text-amber-700 hover:text-amber-900"
    >
      Iniciar sesión
    </Link>
  );
}
