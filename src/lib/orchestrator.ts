import { createServiceClient } from "@/lib/supabase/server";
import { respond, fallbackRespond } from "@/lib/ai/responder";
import { getAdapter, type InboundMessage } from "@/lib/platforms/adapter";
import type { BrandVoice, Organization } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  // 5. Run the responder pipeline. Without a configured model key, fall back
  // to a keyword-based demo reply so ingestion still works end to end.
  const voice = (org.brand_voice ?? {}) as BrandVoice;
  const result = process.env.ANTHROPIC_API_KEY
    ? await respond(inbound.body, {
        voice,
        replyMode: org.reply_mode,
        threshold: Number(org.confidence_threshold),
        history: history ?? [],
      })
    : fallbackRespond(inbound.body, voice);

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
