/**
 * @bsymbolic — Plomería Hub integration
 * components/actions.ts
 *
 * Server actions for the code panel components. Plomería Hub provides
 * its own Supabase server-client factory; this file expects to import
 * it as `createServerSupabase` from the host app. Adjust the import
 * path to match your project layout (commented at top).
 *
 * Tier: Strict. These actions run server-side and are the trust
 * boundary for user-supplied note content. RLS protects against
 * cross-user reads/writes, but we still validate input shapes here
 * because hitting the DB with bad input is wasteful and confuses
 * Supabase error logs.
 */

"use server";

import { setCodeNote, toggleCodeBookmark } from "@/lib/code-notes";

// ⚠️ ADJUST THIS IMPORT to point at Plomería Hub's existing Supabase
// server-client factory. Common patterns:
//   import { createClient } from "@/lib/supabase/server";
//   import { createServerSupabase } from "@/utils/supabase";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function saveCodeNoteAction(
  sectionId: string,
  content: string,
): Promise<ActionResult> {
  // Type narrowing — server actions receive whatever the client sends.
  if (typeof sectionId !== "string" || typeof content !== "string") {
    return { ok: false, error: "Invalid input" };
  }

  try {
    const supabase = await createClient();
    await setCodeNote(supabase, sectionId, content);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("saveCodeNoteAction failed", err);
    return { ok: false, error: message };
  }
}

export async function toggleCodeBookmarkAction(
  sectionId: string,
): Promise<ActionResult<boolean>> {
  if (typeof sectionId !== "string") {
    return { ok: false, error: "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const bookmarked = await toggleCodeBookmark(supabase, sectionId);
    return { ok: true, data: bookmarked };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("toggleCodeBookmarkAction failed", err);
    return { ok: false, error: message };
  }
}
