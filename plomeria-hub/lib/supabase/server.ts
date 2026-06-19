/**
 * Supabase server-client factory (@supabase/ssr).
 *
 * This is the path the integration kit's components/code/actions.ts and
 * CodeReferencePanel import as `@/lib/supabase/server`. In a real
 * Plomería Hub install you'd already have this; it's provided here so
 * the kit works unmodified.
 *
 * Reads the public anon key — every query is still gated by Row-Level
 * Security (see supabase/migrations), so the anon key can only ever
 * touch the signed-in user's own rows.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Surfaced to callers, which already wrap this in try/catch and
    // fall back to the anonymous (no-login) experience.
    throw new Error(
      "Supabase env not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore — middleware/route handlers refresh sessions.
        }
      },
    },
  });
}
