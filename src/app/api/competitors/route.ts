import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLATFORMS = ["instagram", "x", "tiktok", "snapchat", "whatsapp"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const handle = (body?.handle as string | undefined)?.trim();
  const platform = PLATFORMS.includes(body?.platform) ? body.platform : "instagram";
  const notes = (body?.notes as string | undefined)?.trim() || null;
  if (!handle) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
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

  const { error } = await supabase
    .from("competitors")
    .upsert(
      { org_id: membership.org_id, handle, platform, notes },
      { onConflict: "org_id,platform,handle" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { error } = await supabase.from("competitors").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
