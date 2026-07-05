import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import { sendAccessRequestedEmail } from "@/lib/email/access";
import { SITE_URL } from "@/lib/site";

/**
 * Public: a visitor requests access to a workspace by name + email. The insert
 * goes through a SECURITY DEFINER RPC so it works even without the service-role
 * key configured. The owner is then notified (best-effort — only when the
 * service key + Resend are set). Password login is untouched.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "name and a valid email are required" }, { status: 400 });
  }

  // Record the request (RPC bypasses RLS safely; no service key needed).
  const pub = createPublicClient();
  const { error } = await pub.rpc("submit_access_request", { p_name: name, p_email: email });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Best-effort owner notification — needs the service-role key to look up the
  // owner's email and (optionally) Resend to actually deliver.
  let emailed = false;
  try {
    const svc = createServiceClient();
    const { data: org } = await svc
      .from("organizations")
      .select("id")
      .neq("slug", "demo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (org) {
      const { data: ownerMembership } = await svc
        .from("memberships")
        .select("user_id")
        .eq("org_id", org.id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();
      if (ownerMembership?.user_id) {
        const { data: ownerUser } = await svc.auth.admin.getUserById(ownerMembership.user_id);
        const ownerEmail = ownerUser?.user?.email;
        if (ownerEmail) {
          emailed = await sendAccessRequestedEmail({
            ownerEmail,
            requesterName: name,
            requesterEmail: email,
            reviewUrl: `${SITE_URL}/dashboard/team`,
          });
        }
      }
    }
  } catch {
    // Non-fatal: the request is stored and visible in the owner's dashboard.
  }

  return NextResponse.json({ ok: true, emailed });
}
