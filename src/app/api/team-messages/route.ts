import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Post a message to the internal team chat. Org + author are derived
 *  server-side; RLS enforces you can only post as yourself into your org. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = (body?.body as string | undefined)?.trim();
  if (!text) return NextResponse.json({ error: "message body required" }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no organization" }, { status: 404 });

  const { error } = await supabase.from("team_messages").insert({
    org_id: membership.org_id,
    user_id: user.id,
    author_email: user.email ?? "unknown",
    body: text,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
