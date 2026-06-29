import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the email-confirmation / OAuth code for a session, then lands
 *  the user on the dashboard. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
