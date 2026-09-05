import { createServiceClient } from "@/lib/supabase/server";
import { respondBestAvailable, AIUnavailableError } from "@/lib/ai/responder";
import { getAdapter, type InboundMessage } from "@/lib/platforms/adapter";
import type { BrandVoice, Organization, Intent } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function titleFor(intent: Intent, sentiment: string, message: string): string {
  const lower = message.toLowerCase();
  switch (intent) {
    case "price_inquiry": return "Pricing Inquiry";
    case "complaint": return /ship|deliver|late|delay/.test(lower) ? "Complaint About Shipment" : "Customer Complaint";
    case "hot_lead": return "Sales Opportunity";
    case "support":
      if (/refund/.test(lower)) return "Refund Request";
      if (/partner/.test(lower)) return "Partnership Request";
      if (/deliver|ship/.test(lower)) return "Delivery Question";
      if (/recommend|suggest|which one/.test(lower)) return "Product Recommendation";
      return "Support Request";
    case "spam": return "Spam";
    default: return sentiment === "negative" ? "Customer Feedback" : "General Inquiry";
  }
}

function urgencyFor(intent: Intent, sentiment: string, decision: string): "low" | "normal" | "high" {
  if (intent === "complaint" && sentiment === "negative") return "high";
  if (decision === "escalate") return "high";
  if (intent === "hot_lead") return "normal";
  return "low";
}

export async function handleInbound(inbound: InboundMessage, client?: SupabaseClient) {
  const db = client ?? createServiceClient();

  const { data: account } = await db.from("connected_accounts").select("*")
    .eq("platform", inbound.platform).eq("external_id", inbound.accountExternalId).eq("is_active", true).single();
  if (!account) {
    console.warn("No active account for inbound", inbound.accountExternalId);
    return;
  }

  if (inbound.externalMessageId) {
    const { data: duplicate } = await db.from("messages").select("id, conversation_id").eq("external_message_id", inbound.externalMessageId).maybeSingle();
    if (duplicate) return { duplicate: true, messageId: duplicate.id, conversationId: duplicate.conversation_id };
  }

  let adapter;
  try {
    adapter = getAdapter(inbound.platform);
  } catch (err) {
    console.warn("Inbound platform unsupported", inbound.platform, err);
    return { unsupported: true, error: err instanceof Error ? err.message : "Unsupported platform" };
  }

  const { data: orgRow } = await db.from("organizations").select("*").eq("id", account.org_id).single();
  const org = orgRow as Organization | null;
  if (!org) return;

  let { data: conversation } = await db.from("conversations").select("*")
    .eq("account_id", account.id).eq("customer_handle", inbound.customerHandle).eq("status", "open").maybeSingle();

  if (!conversation) {
    const { data } = await db.from("conversations").insert({
      org_id: org.id,
      account_id: account.id,
      platform: inbound.platform,
      customer_handle: inbound.customerHandle,
      customer_email: inbound.customerEmail ?? (inbound.platform === "email" ? inbound.customerHandle : null),
      customer_name: inbound.customerName ?? null,
      email_subject: inbound.subject ?? null,
      thread_key: inbound.inReplyTo ?? inbound.customerEmail ?? null,
    }).select("*").single();
    conversation = data;
  } else if (inbound.platform === "email") {
    await db.from("conversations").update({
      customer_email: inbound.customerEmail ?? conversation.customer_email ?? inbound.customerHandle,
      customer_name: inbound.customerName ?? conversation.customer_name,
      email_subject: inbound.subject ?? conversation.email_subject,
      thread_key: inbound.inReplyTo ?? conversation.thread_key ?? inbound.customerEmail ?? inbound.customerHandle,
    }).eq("id", conversation.id);
  }
  if (!conversation) return;

  const { data: savedInbound, error: inboundError } = await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "inbound",
    author: "customer",
    body: inbound.body,
    external_message_id: inbound.externalMessageId ?? null,
    email_subject: inbound.subject ?? null,
    in_reply_to: inbound.inReplyTo ?? null,
    delivered: true,
    delivery_status: "delivered",
    delivered_at: new Date().toISOString(),
  }).select("id").single();
  if (inboundError?.code === "23505") return { duplicate: true, conversationId: conversation.id };
  if (inboundError || !savedInbound) throw inboundError ?? new Error("Could not persist inbound message.");

  const receivedAt = inbound.receivedAt || new Date().toISOString();
  await db.from("conversations").update({ last_message_at: receivedAt }).eq("id", conversation.id);

  const { data: history } = await db.from("messages").select("author, body")
    .eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(12);

  const voice = (org.brand_voice ?? {}) as BrandVoice;
  let result;
  try {
    result = await respondBestAvailable(inbound.body, {
      voice,
      replyMode: org.reply_mode,
      threshold: Number(org.confidence_threshold),
      history: history ?? [],
      customerName: conversation.customer_name ?? inbound.customerName ?? null,
    });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      await db.from("conversations").update({ status: "escalated", urgency: "high", last_message_at: receivedAt }).eq("id", conversation.id);
      await db.from("escalations").insert({ org_id: org.id, conversation_id: conversation.id, reason: "ai_unavailable", draft: null });
    }
    throw err;
  }

  await db.from("conversations").update({
    intent: result.analysis.intent,
    sentiment: result.analysis.sentiment,
    language: result.analysis.language,
    lead_score: result.analysis.lead_score,
    last_message_at: new Date().toISOString(),
    status: result.decision === "escalate" ? "escalated" : "open",
    title: titleFor(result.analysis.intent, result.analysis.sentiment, inbound.body),
    urgency: urgencyFor(result.analysis.intent, result.analysis.sentiment, result.decision),
    ai_confidence: result.confidence,
    summary: inbound.body.slice(0, 140),
  }).eq("id", conversation.id);

  if (result.decision === "escalate") {
    await db.from("escalations").insert({ org_id: org.id, conversation_id: conversation.id, reason: result.escalation_reason ?? "low_confidence", draft: result.reply || null });
    return result;
  }

  const sending = result.decision === "send";
  const messageStatus = sending ? "pending" : "draft";
  const { data: outbound } = await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "outbound",
    author: "ai",
    body: result.reply,
    ai_confidence: result.confidence,
    ai_meta: { decision: result.decision, intent: result.analysis.intent },
    delivered: false,
    delivery_status: messageStatus,
    delivery_attempts: sending ? 1 : 0,
  }).select("id").single();

  if (!sending) return result;
  if (!outbound) throw new Error("Could not persist outbound message before delivery.");

  try {
    if (inbound.platform === "email") {
      await adapter.send(inbound.accountExternalId, inbound.customerEmail ?? inbound.customerHandle, result.reply);
    } else {
      await adapter.send(inbound.accountExternalId, inbound.customerHandle, result.reply);
    }
    await db.from("messages").update({ delivered: true, delivery_status: "delivered", delivery_error: null, delivered_at: new Date().toISOString() }).eq("id", outbound.id);
  } catch (err) {
    const deliveryError = err instanceof Error ? err.message : "Platform delivery failed";
    await db.from("messages").update({ delivered: false, delivery_status: "failed", delivery_error: deliveryError.slice(0, 1000) }).eq("id", outbound.id);
    await db.from("conversations").update({ status: "escalated", urgency: "high" }).eq("id", conversation.id);
    await db.from("escalations").insert({ org_id: org.id, conversation_id: conversation.id, reason: "delivery_failed", draft: result.reply });
    throw err;
  }

  return result;
}
