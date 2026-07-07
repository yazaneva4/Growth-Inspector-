import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "sign in required" }, { status: 401 }) };
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "no organization" }, { status: 404 }) };
  return { supabase, orgId: membership.org_id as string };
}

/** Add a backup contact (name + phone) shown beside the inbox for when the AI is unavailable. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const phone = (body?.phone as string | undefined)?.trim();
  if (!name || !phone) {
    return NextResponse.json({ error: "name and phone required" }, { status: 400 });
  }

  const ctx = await requireOrg();
  if ("error" in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const { error } = await supabase.from("backup_contacts").insert({ org_id: orgId, name, phone });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ctx = await requireOrg();
  if ("error" in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const { error } = await supabase.from("backup_contacts").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
