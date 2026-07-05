import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAccessRequestedEmail } from "@/lib/email/access";
import { SITE_URL } from "@/lib/site";

/**
 * Public: a visitor requests access to a workspace by name + email. Inserted
 * with the service client (bypasses RLS), then the workspace owner is emailed
 * to review. Keeps password login untouched — this is an additional path in.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "name and a valid email are required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Route the request to the primary (earliest) real workspace.
  const { data: org } = await svc
    .from("organizations")
    .select("id, name")
    .neq("slug", "demo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!org) {
    return NextResponse.json({ error: "no workspace is accepting requests yet" }, { status: 404 });
  }

  // Avoid duplicate pending rows for the same email.
  const { data: existing } = await svc
    .from("access_requests")
    .select("id")
    .eq("org_id", org.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (!existing) {
    const { error } = await svc
      .from("access_requests")
      .insert({ org_id: org.id, name, email, status: "pending" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Find the owner's email and notify them (dry-run logs without RESEND_API_KEY).
  let emailed = false;
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
      try {
        emailed = await sendAccessRequestedEmail({
          ownerEmail,
          requesterName: name,
          requesterEmail: email,
          reviewUrl: `${SITE_URL}/dashboard/team`,
        });
      } catch {
        // Non-fatal: the request is still stored and visible in the dashboard.
      }
    }
  }

  return NextResponse.json({ ok: true, emailed });
}
