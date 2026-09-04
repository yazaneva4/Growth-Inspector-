import { createServiceClient } from "@/lib/supabase/server";
import { respond } from "@/lib/ai/responder";
import type { BrandVoice, Organization } from "@/lib/types";
import crypto from "node:crypto";

const GREETING_EN = "Hi, thanks for calling! I'm your Growth Inspector assistant. How can I help you today?";
const GOODBYE_TIMEOUT = "We did not hear a response - thank you for calling. Goodbye.";
const GOODBYE_ESCALATE = "Thank you - we will pass your request to our team and they will contact you soon. Goodbye.";
const NOT_CONFIGURED = "This number is not yet connected to a Growth Inspector workspace. Goodbye.";
const AI_OFF = "This line's AI assistant is currently unavailable. Please try again later. Goodbye.";

export interface VoiceTurn {
  say: { text: string; lang: "ar" | "en" }[];
  hangup: boolean;
}

function sanitizeForSpeech(text: string): string {
  return text
    .replace(/[*_#`]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function langOf(analysisLanguage?: string): "ar" | "en" {
  return analysisLanguage === "en" ? "en" : "ar";
}

export async function greetCaller(opts: { toNumber: string; fromNumber: string }): Promise<VoiceTurn> {
  const db = createServiceClient();
  const { data: account } = await db.from("connected_accounts").select("*")
    .eq("platform", "call").eq("external_id", opts.toNumber).eq("is_active", true).maybeSingle();
  if (!account) return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };

  const { data: org } = await db.from("organizations").select("*").eq("id", account.org_id).single();
  const orgTyped = org as Organization | null;
  if (!orgTyped || orgTyped.reply_mode === "off") return { say: [{ text: AI_OFF, lang: "en" }], hangup: true };

  const { data: existing } = await db.from("conversations").select("id")
    .eq("account_id", account.id).eq("customer_handle", opts.fromNumber).eq("status", "open").maybeSingle();
  if (!existing) {
    await db.from("conversations").insert({ org_id: account.org_id, account_id: account.id, platform: "call", customer_handle: opts.fromNumber });
  }
  return { say: [{ text: GREETING_EN, lang: "en" }], hangup: false };
}

export async function handleVoiceTurn(opts: { toNumber: string; fromNumber: string; speech: string }): Promise<VoiceTurn> {
  const db = createServiceClient();
  const { data: account } = await db.from("connected_accounts").select("*")
    .eq("platform", "call").eq("external_id", opts.toNumber).eq("is_active", true).maybeSingle();
  if (!account) return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };

  const { data: org } = await db.from("organizations").select("*").eq("id", account.org_id).single();
  const orgTyped = org as Organization | null;
  if (!orgTyped || orgTyped.reply_mode === "off") {
    return { say: [{ text: AI_OFF, lang: "en" }], hangup: true };
  }

  if (!opts.speech.trim()) return { say: [{ text: GOODBYE_TIMEOUT, lang: "ar" }], hangup: true };

  let { data: conversation } = await db.from("conversations").select("*")
    .eq("account_id", account.id).eq("customer_handle", opts.fromNumber).eq("status", "open").maybeSingle();
  if (!conversation) {
    const { data } = await db.from("conversations").insert({
      org_id: account.org_id, account_id: account.id, platform: "call", customer_handle: opts.fromNumber,
    }).select("*").single();
    conversation = data;
  }
  if (!conversation) return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };

  await db.from("messages").insert({
    org_id: account.org_id, conversation_id: conversation.id, direction: "inbound", author: "customer",
    body: opts.speech, delivered: true, delivery_status: "delivered", delivered_at: new Date().toISOString(),
  });

  const { data: history } = await db.from("messages").select("author, body")
    .eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(12);

  const result = await respond(opts.speech, {
    voice: (orgTyped.brand_voice ?? {}) as BrandVoice,
    replyMode: orgTyped.reply_mode === "autonomous" ? "autonomous" : "approval",
    threshold: Number(orgTyped.confidence_threshold),
    history: history ?? [],
    channel: "voice",
  });

  await db.from("conversations").update({
    intent: result.analysis.intent,
    sentiment: result.analysis.sentiment,
    language: result.analysis.language,
    lead_score: result.analysis.lead_score,
    last_message_at: new Date().toISOString(),
    status: result.decision === "escalate" ? "escalated" : "open",
  }).eq("id", conversation.id);

  if (result.decision === "escalate") {
    await db.from("escalations").insert({ org_id: account.org_id, conversation_id: conversation.id,
      reason: result.escalation_reason ?? "low_confidence", draft: result.reply || null });
    return { say: [{ text: GOODBYE_ESCALATE, lang: "en" }], hangup: true };
  }

  const spoken = sanitizeForSpeech(result.reply) || GOODBYE_TIMEOUT;
  const persistedAsSent = orgTyped.reply_mode === "autonomous";
  const { data: outbound } = await db.from("messages").insert({
    org_id: account.org_id, conversation_id: conversation.id, direction: "outbound", author: "ai", body: result.reply,
    ai_confidence: result.confidence,
    ai_meta: { decision: result.decision, intent: result.analysis.intent, channel: "voice" },
    delivered: false,
    delivery_status: persistedAsSent ? "pending" : "draft",
    delivery_attempts: persistedAsSent ? 1 : 0,
  }).select("id").single();

  if (persistedAsSent && outbound) {
    // Live voice delivery is the Twilio response itself. Mark it delivered
    // only after the outbound response row has been persisted successfully.
    await db.from("messages").update({ delivered: true, delivery_status: "delivered", delivered_at: new Date().toISOString() }).eq("id", outbound.id);
  }

  if (!persistedAsSent) {
    await db.from("escalations").insert({ org_id: account.org_id, conversation_id: conversation.id,
      reason: "approval_mode_call", draft: result.reply });
  }

  return { say: [{ text: spoken, lang: langOf(result.analysis.language) }], hangup: false };
}

export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

const WHISPER_ENABLED = Boolean(process.env.OPENAI_API_KEY && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

export async function transcribeAudio(audio: Blob, filename = "audio.webm"): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
  });
  if (!res.ok) throw new Error(`Whisper transcription failed: ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

export async function transcribeWithWhisper(recordingUrl: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
  const audioRes = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: `Basic ${basicAuth}` } });
  if (!audioRes.ok) throw new Error(`Failed to fetch Twilio recording: ${audioRes.status}`);
  return transcribeAudio(await audioRes.blob(), "recording.mp3");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildTwiml(turn: VoiceTurn, actionUrl: string): string {
  const says = turn.say.map(({ text, lang }) => {
    const voice = lang === "ar" ? `voice="Polly.Zeina" language="arb"` : `language="en-US"`;
    return `<Say ${voice}>${escapeXml(text)}</Say>`;
  }).join("\n  ");
  if (turn.hangup) return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  ${says}\n  <Hangup/>\n</Response>`;
  const listen = WHISPER_ENABLED
    ? `<Record action="${escapeXml(actionUrl)}" method="POST" maxLength="30" timeout="3" playBeep="false" trim="trim-silence"/>`
    : `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" language="ar-SA" speechTimeout="auto" timeout="6"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  ${says}\n  ${listen}\n</Response>`;
}
