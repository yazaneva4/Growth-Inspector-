import { createServiceClient } from "@/lib/supabase/server";
import { respondBestAvailable, AIUnavailableError } from "@/lib/ai/responder";
import { getAdapter, type InboundMessage } from "@/lib/platforms/adapter";
import type { BrandVoice, Organization, Intent } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Short, human-scannable conversation title from the AI's classification —
 *  no extra model call needed, updates every turn as context accumulates. */
function titleFor(intent: Intent, sentiment: string, message: string): string {
  const lower = message.toLowerCase();
  switch (intent) {
    case "price_inquiry":
      return "Pricing Inquiry";
    case "complaint":
      if (/ship|deliver|late|delay/.test(lower)) return "Complaint About Shipment";
      return "Customer Complaint";
    case "hot_lead":
      return "Sales Opportunity";
    case "support":
      if (/refund/.test(lower)) return "Refund Request";
      if (/partner/.test(lower)) return "Partnership Request";
      if (/deliver|ship/.test(lower)) return "Delivery Question";
      if (/recommend|suggest|which one/.test(lower)) return "Product Recommendation";
      return "Support Request";
    case "spam":
      return "Spam";
    default:
      return sentiment === "negative" ? "Customer Feedback" : "General Inquiry";
  }
}

function urgencyFor(intent: Intent, sentiment: string, decision: string): "low" | "normal" | "high" {
  if (intent === "complaint" && sentiment === "negative") return "high";
  if (decision === "escalate") return "high";
  if (intent === "hot_lead") return "normal";
  return "low";
}

/**
 * Core ingestion → AI → action pipeline. Defaults to the service-role client
 * (webhook handler) but accepts any client — e.g. the publishable-key client
 * for the public demo workspace, which has scoped insert/update policies.
 */
export async function handleInbound(
  inbound: InboundMessage,
  client?: SupabaseClient,
) {
  const db = client ?? createServiceClient();

  // 1. Resolve the connected account → org.
  const { data: account } = await db
    .from("connected_accounts")
    .select("*")
    .eq("platform", inbound.platform)
    .eq("external_id", inbound.accountExternalId)
    .eq("is_active", true)
    .single();
  if (!account) {
    console.warn("No active account for inbound", inbound.accountExternalId);
    return;
  }

  const { data: orgRow } = await db
    .from("organizations")
    .select("*")
    .eq("id", account.org_id)
    .single();
  const org = orgRow as Organization | null;
  if (!org) return;

  // 2. Find or create the conversation.
  let { data: conversation } = await db
    .from("conversations")
    .select("*")
    .eq("account_id", account.id)
    .eq("customer_handle", inbound.customerHandle)
    .eq("status", "open")
    .maybeSingle();

  if (!conversation) {
    const { data } = await db
      .from("conversations")
      .insert({
        org_id: org.id,
        account_id: account.id,
        platform: inbound.platform,
        customer_handle: inbound.customerHandle,
        customer_name: inbound.customerName ?? null,
      })
      .select("*")
      .single();
    conversation = data;
  }
  if (!conversation) return;

  // 3. Persist the inbound message.
  await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "inbound",
    author: "customer",
    body: inbound.body,
    delivered: true,
  });

  // 4. Load recent history for context.
  const { data: history } = await db
    .from("messages")
    .select("author, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(12);

  // 5. Run the responder pipeline: Claude -> Gemini, both retrying transient
  // failures. If neither can produce a reply, flag it for human attention
  // instead of losing the message or faking a response.
  const voice = (org.brand_voice ?? {}) as BrandVoice;
  let result;
  try {
    result = await respondBestAvailable(inbound.body, {
      voice,
      replyMode: org.reply_mode,
      threshold: Number(org.confidence_threshold),
      history: history ?? [],
    });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      await db
        .from("conversations")
        .update({ status: "escalated", urgency: "high", last_message_at: new Date().toISOString() })
        .eq("id", conversation.id);
      await db.from("escalations").insert({
        org_id: org.id,
        conversation_id: conversation.id,
        reason: "ai_unavailable",
        draft: null,
      });
    }
    throw err;
  }

  // 6. Update conversation signals + auto-generated title/urgency.
  await db
    .from("conversations")
    .update({
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
    })
    .eq("id", conversation.id);

  // 7. Act on the decision.
  if (result.decision === "escalate") {
    await db.from("escalations").insert({
      org_id: org.id,
      conversation_id: conversation.id,
      reason: result.escalation_reason ?? "low_confidence",
      draft: result.reply || null,
    });
    return result;
  }

  // Persist the AI reply (sent or pending-approval draft).
  const sending = result.decision === "send";
  await db.from("messages").insert({
    org_id: org.id,
    conversation_id: conversation.id,
    direction: "outbound",
    author: "ai",
    body: result.reply,
    ai_confidence: result.confidence,
    ai_meta: { decision: result.decision, intent: result.analysis.intent },
    delivered: sending,
  });

  if (sending) {
    const adapter = getAdapter(inbound.platform);
    await adapter.send(
      inbound.accountExternalId,
      inbound.customerHandle,
      result.reply,
    );
  }

  return result;
}
