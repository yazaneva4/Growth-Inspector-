import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const ctx = await getCurrentContext();
  if (!ctx.userId || ctx.isDemo) return NextResponse.json({ error: "Sign in to start a customer conversation." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid customer email is required." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });

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

  const { data: existing } = await db.from("conversations").select("*").eq("org_id", org.id).eq("account_id", account.id).eq("customer_email", email).eq("status", "open").maybeSingle();
  if (existing) return NextResponse.json({ error: "An open conversation already exists for this email. Open that thread and reply there.", conversation: existing, existing: true }, { status: 409 });

  const { data: conversation, error } = await db.from("conversations").insert({
    org_id: org.id,
    account_id: account.id,
    platform: "email",
    customer_handle: email,
    customer_email: email,
    customer_name: name,
    email_subject: subject,
    thread_key: email,
    status: "open",
    assigned_to: ctx.userId,
    last_message_at: new Date().toISOString(),
  }).select("id, customer_name, customer_handle, customer_email, platform, intent, status, lead_score, last_message_at, title, urgency, assigned_to, email_subject, thread_key").single();
  if (error || !conversation) return NextResponse.json({ error: error?.message || "Could not create conversation." }, { status: 500 });

  const { data: message, error: messageError } = await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "outbound",
    author: "human",
    body: text,
    email_subject: subject,
    ai_meta: { sender_user_id: ctx.userId, sender_email: ctx.email, initial_outreach: true },
    delivered: false,
    delivery_status: "pending",
    delivery_attempts: 1,
  }).select("id, conversation_id, author, direction, body, ai_confidence, created_at, delivered, delivery_status").single();
  if (messageError || !message) {
    await db.from("conversations").delete().eq("id", conversation.id);
    return NextResponse.json({ error: messageError?.message || "Could not save the email." }, { status: 500 });
  }

  try {
    await sendEmail({ to: email, subject, text });
    await db.from("messages").update({ delivered: true, delivery_status: "delivered", delivery_error: null, delivered_at: new Date().toISOString() }).eq("id", message.id);
    return NextResponse.json({ ok: true, conversation, message: { ...message, delivered: true, delivery_status: "delivered" } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Email delivery failed";
    await db.from("messages").update({ delivered: false, delivery_status: "failed", delivery_error: detail.slice(0, 1000) }).eq("id", message.id);
    return NextResponse.json({ error: detail, conversation, message: { ...message, delivered: false, delivery_status: "failed" } }, { status: 502 });
  }
}
