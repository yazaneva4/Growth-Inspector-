import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODES = ["autonomous", "approval", "off"] as const;

/** Save the signed-in workspace's brand voice + responder settings. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

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

  const guardrails =
    typeof body.guardrails === "string"
      ? body.guardrails
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

  const brand_voice = {
    tone: typeof body.tone === "string" ? body.tone : "",
    facts: typeof body.facts === "string" ? body.facts : "",
    guardrails,
  };

  const reply_mode = MODES.includes(body.reply_mode) ? body.reply_mode : "approval";
  let threshold = Number(body.confidence_threshold);
  if (!Number.isFinite(threshold)) threshold = 0.75;
  threshold = Math.min(1, Math.max(0, threshold));

  const { error } = await supabase
    .from("organizations")
    .update({ brand_voice, reply_mode, confidence_threshold: threshold })
    .eq("id", membership.org_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
