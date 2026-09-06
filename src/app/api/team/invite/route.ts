import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["admin", "agent"] as const;

/** Invite an employee (by email) to the signed-in user's workspace. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const role = ROLES.includes(body?.role) ? body.role : "agent";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
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

  const { error } = await supabase
    .from("team_invites")
    .upsert(
      { org_id: membership.org_id, email, role, accepted: false },
      { onConflict: "org_id,email" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If this email already has an account, join it immediately. The RPC runs
  // with elevated DB privileges but verifies that the caller belongs to the
  // target workspace before touching the target user's membership.
  const { error: acceptError } = await supabase.rpc("accept_existing_team_invite", {
    p_org_id: membership.org_id,
    p_email: email,
  });
  if (acceptError) {
    // Keep the normal pending-invite flow working if the migration has not yet
    // been applied; new users can still accept through accept_pending_invites.
    if (!acceptError.message.toLowerCase().includes("does not exist")) {
      return NextResponse.json({ error: acceptError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}