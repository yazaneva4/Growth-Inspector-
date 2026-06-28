import { createServiceClient } from "@/lib/supabase/server";
import { respond } from "@/lib/ai/responder";
import { getAdapter, type InboundMessage } from "@/lib/platforms/adapter";
import type { BrandVoice, Organization } from "@/lib/types";

/**
 * Core ingestion → AI → action pipeline. Runs in a trusted server context
 * (webhook handler) with the service-role client, so it must scope every
 * query by org_id itself rather than relying on RLS.
 */
export async function handleInbound(inbound: InboundMessage) {
  const db = createServiceClient();

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

  // 5. Run the responder pipeline.
  const result = await respond(inbound.body, {
    voice: (org.brand_voice ?? {}) as BrandVoice,
    replyMode: org.reply_mode,
    threshold: Number(org.confidence_threshold),
    history: history ?? [],
  });

  // 6. Update conversation signals.
  await db
    .from("conversations")
    .update({
      intent: result.analysis.intent,
      sentiment: result.analysis.sentiment,
      language: result.analysis.language,
      lead_score: result.analysis.lead_score,
      last_message_at: new Date().toISOString(),
      status: result.decision === "escalate" ? "escalated" : "open",
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
    return;
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
