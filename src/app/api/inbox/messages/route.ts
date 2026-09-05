import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const ctx = await getCurrentContext();
  if (!ctx.userId || ctx.isDemo) return NextResponse.json({ error: "Sign in to reply to customers." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!conversationId || !text) return NextResponse.json({ error: "conversationId and message body are required." }, { status: 400 });

  const authDb = await createClient();
  const { data: org } = await authDb.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  if (!org) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const db = createServiceClient();
  const { data: conversation } = await db.from("conversations").select("id, org_id, platform, customer_email, customer_handle, email_subject, thread_key").eq("id", conversationId).eq("org_id", org.id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const recipient = conversation.customer_email || (conversation.platform === "email" ? conversation.customer_handle : null);
  if (conversation.platform === "email" && !recipient) return NextResponse.json({ error: "This email conversation has no customer email identity." }, { status: 400 });

  const { data: latestInbound } = conversation.platform === "email"
    ? await db.from("messages").select("external_message_id").eq("conversation_id", conversation.id).eq("direction", "inbound").not("external_message_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const replyTo = latestInbound?.external_message_id ?? conversation.thread_key ?? undefined;

  const { data: message, error } = await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "outbound",
    author: "human",
    body: text,
    ai_meta: { sender_user_id: ctx.userId, sender_email: ctx.email },
    delivered: false,
    delivery_status: "pending",
    delivery_attempts: 1,
  }).select("id, conversation_id, author, direction, body, ai_confidence, created_at, delivered, delivery_status").single();
  if (error || !message) return NextResponse.json({ error: error?.message || "Could not save message." }, { status: 500 });

  try {
    if (conversation.platform === "email") {
      await sendEmail({
        to: recipient!,
        subject: conversation.email_subject?.startsWith("Re:") ? conversation.email_subject : `Re: ${conversation.email_subject || "Your Growth Inspector conversation"}`,
        text,
        inReplyTo: replyTo,
        references: replyTo,
      });
    } else {
      return NextResponse.json({ error: "This conversation channel does not yet have a human-send adapter." }, { status: 501 });
    }
    await db.from("messages").update({ delivered: true, delivery_status: "delivered", delivery_error: null, delivered_at: new Date().toISOString() }).eq("id", message.id);
    await db.from("conversations").update({ last_message_at: new Date().toISOString(), assigned_to: ctx.userId }).eq("id", conversation.id);
    return NextResponse.json({ ok: true, message: { ...message, delivered: true, delivery_status: "delivered" } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Email delivery failed";
    await db.from("messages").update({ delivered: false, delivery_status: "failed", delivery_error: detail.slice(0, 1000) }).eq("id", message.id);
    return NextResponse.json({ error: detail, message: { ...message, delivered: false, delivery_status: "failed" } }, { status: 502 });
  }
}
