/**
 * Magic-link landing route.
 *
 * Supabase emails a link to /auth/confirm?token_hash=...&type=magiclink.
 * We verify the OTP, which sets the session cookie, then redirect the
 * user onward (defaults to home).
 */

import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) {
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // fall through to the error redirect
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
