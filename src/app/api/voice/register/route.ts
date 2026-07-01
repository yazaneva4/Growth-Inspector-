import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Attach a Twilio phone number to the signed-in user's workspace so incoming
 * calls to it are answered by their AI. Point the Twilio number's Voice
 * webhook at /api/voice (and optionally the Status Callback at /api/voice/status).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = (body?.phone as string | undefined)?.trim();
  const displayName = (body?.displayName as string | undefined)?.trim() || "Phone line";
  if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
    return NextResponse.json(
      { error: "phone must be E.164 format, e.g. +9665XXXXXXXX" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "no organization" }, { status: 404 });
  }

  const { error } = await supabase.from("connected_accounts").upsert(
    {
      org_id: membership.org_id,
      platform: "call",
      external_id: phone,
      display_name: displayName,
      is_active: true,
    },
    { onConflict: "platform,external_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
