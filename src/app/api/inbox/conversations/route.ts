import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ctx = await getCurrentContext();
  if (!ctx.userId || ctx.isDemo) return NextResponse.json({ error: "Sign in to start a customer conversation." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid customer email is required." }, { status: 400 });

  const authDb = await createClient();
  const { data: org } = await authDb.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  if (!org) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const db = createServiceClient();
  let { data: account } = await db.from("connected_accounts").select("id, org_id, external_id").eq("org_id", org.id).eq("platform", "email").eq("is_active", true).limit(1).maybeSingle();
  if (!account) {
    const { data: created, error } = await db.from("connected_accounts").insert({ org_id: org.id, platform: "email", external_id: "support-inbox", display_name: "Support Email", credentials: {}, is_active: true }).select("id, org_id, external_id").single();
    if (error || !created) return NextResponse.json({ error: "Email inbox is not configured for this workspace." }, { status: 503 });
    account = created;
  }

  const { data: existing } = await db.from("conversations").select("*").eq("org_id", org.id).eq("account_id", account.id).eq("customer_handle", email).eq("status", "open").maybeSingle();
  if (existing) return NextResponse.json({ conversation: existing, existing: true });

  const { data: conversation, error } = await db.from("conversations").insert({
    org_id: org.id,
    account_id: account.id,
    platform: "email",
    customer_handle: email,
    customer_email: email,
    customer_name: name,
    email_subject: subject || "Your Growth Inspector conversation",
    thread_key: email,
    status: "open",
  }).select("id, customer_name, customer_handle, customer_email, platform, intent, status, lead_score, last_message_at, title, urgency, assigned_to").single();
  if (error || !conversation) return NextResponse.json({ error: error?.message || "Could not create conversation." }, { status: 500 });
  return NextResponse.json({ ok: true, conversation });
}
