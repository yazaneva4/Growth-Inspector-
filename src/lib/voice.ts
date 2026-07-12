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
  /** true => end the call after speaking; false => gather the caller's next turn. */
  hangup: boolean;
}

/** Strip markdown/emoji noise so text-to-speech reads naturally. */
function sanitizeForSpeech(text: string): string {
  return text
    .replace(/[*_#`]/g, "")
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function langOf(analysisLanguage?: string): "ar" | "en" {
  return analysisLanguage === "en" ? "en" : "ar";
}

/** The very first leg of a call: greet and start listening. */
export async function greetCaller(opts: {
  toNumber: string;
  fromNumber: string;
}): Promise<VoiceTurn> {
  const db = createServiceClient();

  const { data: account } = await db
    .from("connected_accounts")
    .select("*")
    .eq("platform", "call")
    .eq("external_id", opts.toNumber)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) {
    return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };
  }

  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("id", account.org_id)
    .single();
  const orgTyped = org as Organization | null;

  if (!orgTyped || orgTyped.reply_mode === "off") {
    return { say: [{ text: AI_OFF, lang: "en" }], hangup: true };
  }

  // Open (or reuse) the conversation for this caller.
  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("account_id", account.id)
    .eq("customer_handle", opts.fromNumber)
    .eq("status", "open")
    .maybeSingle();

  if (!existing) {
    await db.from("conversations").insert({
      org_id: account.org_id,
      account_id: account.id,
      platform: "call",
      customer_handle: opts.fromNumber,
    });
  }

  return {
    say: [{ text: GREETING_EN, lang: "en" }],
    hangup: false,
  };
}

/** A subsequent turn: the caller said something (or the gather timed out). */
export async function handleVoiceTurn(opts: {
  toNumber: string;
  fromNumber: string;
  speech: string;
}): Promise<VoiceTurn> {
  const db = createServiceClient();

  const { data: account } = await db
    .from("connected_accounts")
    .select("*")
    .eq("platform", "call")
    .eq("external_id", opts.toNumber)
    .eq("is_active", true)
    .maybeSingle();
  if (!account) {
    return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };
  }

  if (!opts.speech.trim()) {
    // Gather timed out with no speech captured.
    return { say: [{ text: GOODBYE_TIMEOUT, lang: "ar" }], hangup: true };
  }

  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("id", account.org_id)
    .single();
  const orgTyped = org as Organization;

  let { data: conversation } = await db
    .from("conversations")
    .select("*")
    .eq("account_id", account.id)
    .eq("customer_handle", opts.fromNumber)
    .eq("status", "open")
    .maybeSingle();

  if (!conversation) {
    const { data } = await db
      .from("conversations")
      .insert({
        org_id: account.org_id,
        account_id: account.id,
        platform: "call",
        customer_handle: opts.fromNumber,
      })
      .select("*")
      .single();
    conversation = data;
  }
  if (!conversation) {
    return { say: [{ text: NOT_CONFIGURED, lang: "en" }], hangup: true };
  }

  await db.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    direction: "inbound",
    author: "customer",
    body: opts.speech,
    delivered: true,
  });

  const { data: history } = await db
    .from("messages")
    .select("author, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(12);

  const result = await respond(opts.speech, {
    voice: (orgTyped.brand_voice ?? {}) as BrandVoice,
    // A live call can't pause for human approval mid-conversation; treat
    // "approval" as autonomous for the spoken reply, but still log an
    // escalation below so a human reviews the transcript afterward.
    replyMode: orgTyped.reply_mode === "autonomous" ? "autonomous" : "approval",
    threshold: Number(orgTyped.confidence_threshold),
    history: history ?? [],
    channel: "voice",
  });

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

  if (result.decision === "escalate") {
    await db.from("escalations").insert({
      org_id: account.org_id,
      conversation_id: conversation.id,
      reason: result.escalation_reason ?? "low_confidence",
      draft: result.reply || null,
    });
    return {
      say: [{ text: GOODBYE_ESCALATE, lang: "en" }],
      hangup: true,
    };
  }

  const spoken = sanitizeForSpeech(result.reply) || GOODBYE_TIMEOUT;
  const persistedAsSent = orgTyped.reply_mode === "autonomous";

  await db.from("messages").insert({
    org_id: account.org_id,
    conversation_id: conversation.id,
    direction: "outbound",
    author: "ai",
    body: result.reply,
    ai_confidence: result.confidence,
    ai_meta: { decision: result.decision, intent: result.analysis.intent, channel: "voice" },
    delivered: persistedAsSent,
  });

  // If the org is in "approval" mode, flag this turn for a human to review
  // after the fact — the caller already heard the AI's answer live.
  if (!persistedAsSent) {
    await db.from("escalations").insert({
      org_id: account.org_id,
      conversation_id: conversation.id,
      reason: "approval_mode_call",
      draft: result.reply,
    });
  }

  return {
    say: [{ text: spoken, lang: langOf(result.analysis.language) }],
    hangup: false,
  };
}

/**
 * Verifies Twilio's X-Twilio-Signature header (HMAC-SHA1 of the URL + sorted
 * form params, base64-encoded). Skips verification when TWILIO_AUTH_TOKEN
 * isn't configured, so the webhook still works before Twilio is set up.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // not configured — allow through
  if (!signature) return false;

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");

  const expected = crypto
    .createHmac("sha1", token)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * When set, listening switches from Twilio's built-in speech recognition to
 * recording the caller + transcribing with OpenAI Whisper — meaningfully
 * better accuracy on Khaleeji/Najdi dialect and Arabic/English code-switching.
 * Downloading a Twilio recording requires Basic Auth with the Account SID.
 */
const WHISPER_ENABLED = Boolean(
  process.env.OPENAI_API_KEY &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN,
);

/** Transcribes an audio file (any source) with OpenAI Whisper. Shared by the
 *  Twilio call pipeline and the in-dashboard browser voice chat. */
export async function transcribeAudio(audio: Blob, filename = "audio.webm"): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  // No `language` param — let Whisper auto-detect Arabic/English/code-switched
  // speech rather than biasing toward one.

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper transcription failed: ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

/** Downloads a Twilio call recording and transcribes it with Whisper. */
export async function transcribeWithWhisper(recordingUrl: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");

  const audioRes = await fetch(`${recordingUrl}.mp3`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!audioRes.ok) {
    throw new Error(`Failed to fetch Twilio recording: ${audioRes.status}`);
  }
  const audioBlob = await audioRes.blob();
  return transcribeAudio(audioBlob, "recording.mp3");
}

/** Builds the TwiML response: speak each line, then listen or hang up. */
export function buildTwiml(turn: VoiceTurn, actionUrl: string): string {
  const says = turn.say
    .map(({ text, lang }) => {
      const voice = lang === "ar" ? `voice="Polly.Zeina" language="arb"` : `language="en-US"`;
      return `<Say ${voice}>${escapeXml(text)}</Say>`;
    })
    .join("\n  ");

  if (turn.hangup) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  ${says}\n  <Hangup/>\n</Response>`;
  }

  const listen = WHISPER_ENABLED
    ? `<Record action="${escapeXml(actionUrl)}" method="POST" maxLength="30" timeout="3" playBeep="false" trim="trim-silence"/>`
    : `<Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" language="ar-SA" speechTimeout="auto" timeout="6"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  ${says}\n  ${listen}\n</Response>`;
}
