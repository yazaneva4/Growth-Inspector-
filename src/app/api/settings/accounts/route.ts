import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/lib/types";

const CONNECTABLE_PLATFORMS = ["instagram", "x", "snapchat", "tiktok"] as const;

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

/** Connect (or reconnect) a real business account so its webhook can match to this org. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const ctx = await requireOrg();
  if ("error" in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const platform = body.platform as SocialPlatform;
  if (!CONNECTABLE_PLATFORMS.includes(platform as (typeof CONNECTABLE_PLATFORMS)[number])) {
    return NextResponse.json({ error: "unsupported platform" }, { status: 400 });
  }
  const externalId = (body.externalId as string | undefined)?.trim();
  const displayName = (body.displayName as string | undefined)?.trim();
  if (!externalId || !displayName) {
    return NextResponse.json({ error: "externalId and displayName required" }, { status: 400 });
  }

  const { error } = await supabase.from("connected_accounts").upsert(
    {
      org_id: orgId,
      platform,
      external_id: externalId,
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

/** Deactivate a connected account (stops matching inbound webhooks, keeps history). */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ctx = await requireOrg();
  if ("error" in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const { error } = await supabase
    .from("connected_accounts")
    .update({ is_active: false })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
