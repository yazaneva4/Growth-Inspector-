import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Completes Growth Inspector email/OAuth authentication and always redirects back to the app. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const code = req.nextUrl.searchParams.get("code");
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("Growth Inspector auth callback:", error.message);
  } else if (tokenHash && (type === "magiclink" || type === "email" || type === "recovery")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "email" | "recovery" });
    if (error) console.error("Growth Inspector email callback:", error.message);
  }

  const next = req.nextUrl.searchParams.get("next");
  const dest = next && /^\/[A-Za-z0-9_\-./?=&%]*$/.test(next) ? next : "/dashboard/inbox";
  return NextResponse.redirect(new URL(dest, req.url));
}
