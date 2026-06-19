/**
 * @bsymbolic — Plomería Hub integration
 * lib/code-notes.ts
 *
 * Server + browser helpers for the code_user_notes and
 * code_user_bookmarks tables. All inputs validated; all queries
 * scoped by auth.uid() via RLS so the helpers can't accidentally
 * leak another user's notes even if called with a wrong user_id.
 *
 * Tier: Strict. User data, billing-adjacent product, paid surface.
 *
 * Assumes Supabase client is constructed by the consumer (Plomería
 * Hub already has its own createClient wrappers per @supabase/ssr
 * patterns). These helpers accept the client as the first argument.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SECTION_ID_LENGTH = 32;
const MAX_NOTE_LENGTH = 16_384;

export interface CodeNote {
  sectionId: string;
  content: string;
  updatedAt: string;
}

/* ============================================================
   Input validation
============================================================ */

function assertValidSectionId(sectionId: unknown): asserts sectionId is string {
  if (typeof sectionId !== "string") {
    throw new TypeError("sectionId must be a string");
  }
  if (sectionId.length === 0 || sectionId.length > MAX_SECTION_ID_LENGTH) {
    throw new RangeError(
      `sectionId length must be 1–${MAX_SECTION_ID_LENGTH}, got ${sectionId.length}`,
    );
  }
}

function assertValidContent(content: unknown): asserts content is string {
  if (typeof content !== "string") {
    throw new TypeError("content must be a string");
  }
  if (content.length > MAX_NOTE_LENGTH) {
    throw new RangeError(
      `note content exceeds ${MAX_NOTE_LENGTH} chars; got ${content.length}`,
    );
  }
}

/* ============================================================
   Notes
============================================================ */

/**
 * Get the authenticated user's note for a single section.
 * Returns null when no note exists.
 */
export async function getCodeNote(
  supabase: SupabaseClient,
  sectionId: string,
): Promise<CodeNote | null> {
  assertValidSectionId(sectionId);

  const { data, error } = await supabase
    .from("code_user_notes")
    .select("section_id, content, updated_at")
    .eq("section_id", sectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`getCodeNote failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    sectionId: data.section_id,
    content: data.content,
    updatedAt: data.updated_at,
  };
}

/**
 * Upsert a note. Empty content deletes the row (so we don't keep
 * abandoned empty notes lying around).
 */
export async function setCodeNote(
  supabase: SupabaseClient,
  sectionId: string,
  content: string,
): Promise<CodeNote | null> {
  assertValidSectionId(sectionId);
  assertValidContent(content);

  // Resolve the current user. Required because user_id is NOT NULL
  // and the RLS policy doesn't fill it in for us.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("setCodeNote requires an authenticated user");
  }
  const userId = userData.user.id;

  if (content.trim().length === 0) {
    // Drop the row when the user clears their note
    const { error: delErr } = await supabase
      .from("code_user_notes")
      .delete()
      .eq("section_id", sectionId);
    if (delErr) throw new Error(`setCodeNote delete failed: ${delErr.message}`);
    return null;
  }

  const { data, error } = await supabase
    .from("code_user_notes")
    .upsert(
      { user_id: userId, section_id: sectionId, content },
      { onConflict: "user_id,section_id" },
    )
    .select("section_id, content, updated_at")
    .single();

  if (error) {
    throw new Error(`setCodeNote upsert failed: ${error.message}`);
  }

  return {
    sectionId: data.section_id,
    content: data.content,
    updatedAt: data.updated_at,
  };
}

/**
 * List every note the user has authored. Useful for the
 * "your code notes" dashboard view.
 */
export async function listCodeNotes(
  supabase: SupabaseClient,
): Promise<CodeNote[]> {
  const { data, error } = await supabase
    .from("code_user_notes")
    .select("section_id, content, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`listCodeNotes failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    sectionId: row.section_id,
    content: row.content,
    updatedAt: row.updated_at,
  }));
}

/* ============================================================
   Bookmarks
============================================================ */

/**
 * Returns the set of section IDs the authenticated user has bookmarked.
 */
export async function listCodeBookmarks(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("code_user_bookmarks")
    .select("section_id");

  if (error) {
    throw new Error(`listCodeBookmarks failed: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.section_id));
}

/**
 * Toggle the bookmark on a section. Returns the new bookmarked state.
 */
export async function toggleCodeBookmark(
  supabase: SupabaseClient,
  sectionId: string,
): Promise<boolean> {
  assertValidSectionId(sectionId);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("toggleCodeBookmark requires an authenticated user");
  }
  const userId = userData.user.id;

  // Probe existing row
  const { data: existing, error: probeError } = await supabase
    .from("code_user_bookmarks")
    .select("id")
    .eq("section_id", sectionId)
    .maybeSingle();

  if (probeError) {
    throw new Error(`toggleCodeBookmark probe failed: ${probeError.message}`);
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from("code_user_bookmarks")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw new Error(`toggleCodeBookmark delete failed: ${delErr.message}`);
    return false;
  }

  const { error: insErr } = await supabase
    .from("code_user_bookmarks")
    .insert({ user_id: userId, section_id: sectionId });
  if (insErr) throw new Error(`toggleCodeBookmark insert failed: ${insErr.message}`);
  return true;
}
