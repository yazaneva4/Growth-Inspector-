import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendAccessApprovedEmail } from "@/lib/email/access";
import { SITE_URL } from "@/lib/site";

function randomPassword(): string {
  // Never shown to anyone — the user sets their own via the recovery link.
  return `Gs-${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

/**
 * Owner decides on an access request. RLS scopes the read/update to the owner's
 * own workspace; approval provisions the account (service role) and joins them
 * to that workspace, then emails a set-password link.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  const decision = body?.decision as string | undefined; // "approve" | "reject"
  if (!id || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json({ error: "id and decision (approve|reject) required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  // RLS ensures the caller can only see requests for their own workspace.
  const { data: request } = await supabase
    .from("access_requests")
    .select("id, org_id, name, email, status")
    .eq("id", id)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "request not found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "already decided" }, { status: 409 });
  }

  if (decision === "reject") {
    await supabase
      .from("access_requests")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Approve → provision the account with the service role.
  const svc = createServiceClient();

  // Create the user (idempotent: reuse if the email already exists).
  let userId: string | undefined;
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: request.email,
    password: randomPassword(),
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (createErr) {
    // Likely already registered — look them up so we can still add + email them.
    const { data: list } = await svc.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email?.toLowerCase() === request.email)?.id;
  }
  if (!userId) {
    return NextResponse.json(
      { error: "could not provision the account (is SUPABASE_SERVICE_ROLE_KEY set?)" },
      { status: 500 },
    );
  }

  // Join them to the owner's workspace (default role: agent).
  await svc
    .from("memberships")
    .upsert({ org_id: request.org_id, user_id: userId, role: "agent" }, { onConflict: "org_id,user_id" });

  // Email a set-password link (Resend). Dry-run returns the link for the owner.
  let emailed = false;
  let setPasswordUrl: string | null = null;
  const { data: link } = await svc.auth.admin.generateLink({
    type: "recovery",
    email: request.email,
    options: { redirectTo: `${SITE_URL}/auth/callback?next=/dashboard/inbox` },
  });
  setPasswordUrl = link?.properties?.action_link ?? null;
  if (setPasswordUrl) {
    try {
      emailed = await sendAccessApprovedEmail({
        email: request.email,
        name: request.name,
        setPasswordUrl,
      });
    } catch {
      // Non-fatal — the owner still gets the link back to share manually.
    }
  }

  await supabase
    .from("access_requests")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    status: "approved",
    emailed,
    // Only returned so the owner can copy it when email delivery isn't set up.
    setPasswordUrl: emailed ? null : setPasswordUrl,
  });
}
