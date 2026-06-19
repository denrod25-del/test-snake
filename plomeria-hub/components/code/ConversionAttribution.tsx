"use client";

/**
 * @bsymbolic — Plomería Hub integration
 * components/ConversionAttribution.tsx
 *
 * Client-only component. Mount once near the top of the layout tree
 * for any page that can receive traffic from code.bsymbolic.com.
 *
 * Reads `?ref=code&seccion=...` query params on mount and persists
 * them to localStorage so the signup flow downstream can record the
 * attribution as part of the new user's metadata.
 *
 * Renders nothing — pure side-effect.
 *
 * Wire-up on the consumer side:
 *   - Drop into your root layout or marketing pages
 *   - At signup completion, read getAttribution() and write the
 *     fields onto the user's profile row
 *   - Surface counts in a dashboard query for monthly review
 */

import { useEffect } from "react";

const STORAGE_KEY = "ph.attribution.code";
// Lifetime of the attribution window. After this many days the user
// is treated as organic; tune to whatever your sales cycle requires.
const ATTRIBUTION_TTL_DAYS = 30;

export interface CodeAttribution {
  ref: string;
  sectionId?: string;
  capturedAt: string; // ISO date
}

export function ConversionAttribution() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref !== "code") return;

      const sectionId = url.searchParams.get("seccion") ?? undefined;
      const payload: CodeAttribution = {
        ref,
        sectionId,
        capturedAt: new Date().toISOString(),
      };

      // Don't overwrite an existing valid attribution within TTL —
      // first touch wins. This prevents a paid-ad URL from clobbering
      // the original organic referral.
      const existing = readAttribution();
      if (existing) return;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage disabled / SSR / malformed URL — quietly drop.
    }
  }, []);

  return null;
}

/**
 * Read the stored attribution, expiring entries older than the TTL.
 * Returns null when nothing valid is stored.
 *
 * Call from your signup completion handler:
 *
 *   const attribution = getAttribution();
 *   if (attribution) {
 *     await supabase.from("profiles").update({
 *       signup_ref: attribution.ref,
 *       signup_section: attribution.sectionId,
 *     }).eq("id", userId);
 *     clearAttribution();
 *   }
 */
export function getAttribution(): CodeAttribution | null {
  return readAttribution();
}

export function clearAttribution(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readAttribution(): CodeAttribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CodeAttribution;

    if (typeof parsed.ref !== "string" || typeof parsed.capturedAt !== "string") {
      return null;
    }

    const captured = new Date(parsed.capturedAt).getTime();
    if (!Number.isFinite(captured)) return null;

    const ageMs = Date.now() - captured;
    const ttlMs = ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) {
      clearAttribution();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
