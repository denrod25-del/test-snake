/**
 * Supabase browser-client factory (@supabase/ssr).
 *
 * Used by client components (login form, header auth status). Shares the
 * session cookie with the server client in lib/supabase/server.ts, so a
 * sign-in here immediately enables the server-rendered notes/bookmarks.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** True when Supabase env vars are present (auth features available). */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
