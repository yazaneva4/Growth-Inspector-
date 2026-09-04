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

  // Reject unsupported channels before the AI can generate or persist a reply.
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
      customer_name: inbound.customerName ?? null,
    }).select("*").single();
    conversation = data;
  }
  if (!conversation) return;

  await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "inbound",
    author: "customer",
    body: inbound.body,
    delivered: true,
    delivery_status: "delivered",
    delivered_at: new Date().toISOString(),
  });

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
      await db.from("conversations").update({ status: "escalated", urgency: "high", last_message_at: new Date().toISOString() }).eq("id", conversation.id);
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
    await db.from("escalations").insert({
      org_id: org.id,
      conversation_id: conversation.id,
      reason: result.escalation_reason ?? "low_confidence",
      draft: result.reply || null,
    });
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
    await adapter.send(inbound.accountExternalId, inbound.customerHandle, result.reply);
    await db.from("messages").update({
      delivered: true,
      delivery_status: "delivered",
      delivery_error: null,
      delivered_at: new Date().toISOString(),
    }).eq("id", outbound.id);
  } catch (err) {
    const deliveryError = err instanceof Error ? err.message : "Platform delivery failed";
    await db.from("messages").update({
      delivered: false,
      delivery_status: "failed",
      delivery_error: deliveryError.slice(0, 1000),
    }).eq("id", outbound.id);
    await db.from("conversations").update({ status: "escalated", urgency: "high" }).eq("id", conversation.id);
    await db.from("escalations").insert({
      org_id: org.id,
      conversation_id: conversation.id,
      reason: "delivery_failed",
      draft: result.reply,
    });
    throw err;
  }

  return result;
}
