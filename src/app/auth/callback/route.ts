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
  // Honor ?next= (defaults to the inbox), but only allow same-app relative paths.
  const next = req.nextUrl.searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/dashboard/inbox";
  return NextResponse.redirect(new URL(dest, req.url));
}
