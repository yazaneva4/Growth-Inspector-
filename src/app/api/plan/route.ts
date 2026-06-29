import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLANS = ["starter", "business", "agency"] as const;
type Plan = (typeof PLANS)[number];

/**
 * Change the signed-in user's organization plan. RLS scopes the update to the
 * org they belong to. Real payment (Moyasar/Tap/Stripe) hooks in here later;
 * for now selecting a plan updates the workspace tier directly.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const plan: string | undefined = body?.plan;
  if (!plan || !PLANS.includes(plan as Plan)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  // Find the user's org (RLS ensures it's theirs).
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "no organization" }, { status: 404 });
  }

  const { error } = await supabase
    .from("organizations")
    .update({ plan })
    .eq("id", membership.org_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, plan });
}
