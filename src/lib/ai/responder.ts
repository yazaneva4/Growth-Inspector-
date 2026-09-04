import { anthropic, MODELS } from "./anthropic";
import { gemini, geminiConfigured, GEMINI_MODEL } from "./gemini";
import { openrouterChatJSON, openrouterConfigured, OPENROUTER_MODEL_A, OPENROUTER_MODEL_B } from "./openrouter";
import { zaiChatJSON, zaiConfigured } from "./zai";
import { withRetry } from "./retry";
import type { BrandVoice, Intent, Language } from "@/lib/types";

export const HARD_BLOCK_TOPICS = [
  "politics or government criticism",
  "religion or religious rulings",
  "gender / relationship sensitivities",
  "legal advice",
  "medical diagnosis or advice",
  "pricing or refund commitments beyond stated policy",
];

export interface MessageAnalysis {
  intent: Intent;
  sentiment: "positive" | "neutral" | "negative";
  language: Language;
  lead_score: number;
  hard_block: boolean;
  hard_block_reason?: string;
}

export interface ResponderResult {
  analysis: MessageAnalysis;
  reply: string;
  confidence: number;
  decision: "send" | "draft" | "escalate";
  escalation_reason?: "low_confidence" | "hard_block_topic" | "high_intent";
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["price_inquiry", "complaint", "hot_lead", "spam", "support", "other"] },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    language: { type: "string", enum: ["ar", "ar-dialect", "arabizi", "en", "mixed"] },
    lead_score: { type: "number", description: "0-100 buying intent" },
    hard_block: { type: "boolean" },
    hard_block_reason: { type: "string" },
  },
  required: ["intent", "sentiment", "language", "lead_score", "hard_block"],
  additionalProperties: false,
} as const;

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    confidence: { type: "number", description: "0-1 self-assessed confidence" },
  },
  required: ["reply", "confidence"],
  additionalProperties: false,
} as const;

function brandVoiceBlock(voice: BrandVoice): string {
  const parts: string[] = [];
  if (voice.tone) parts.push(`Tone: ${voice.tone}`);
  if (voice.facts) parts.push(`Business facts you may use:\n${voice.facts}`);
  if (voice.guardrails?.length) parts.push(`Never: ${voice.guardrails.join("; ")}`);
  if (voice.examples?.length) {
    parts.push("Imitate the dialect and style of these past replies:\n" + voice.examples.map((e) => `Customer: ${e.customer}\nReply: ${e.reply}`).join("\n---\n"));
  }
  return parts.join("\n\n") || "(no brand voice configured yet)";
}

async function structured<T>(model: string, system: string, user: string, schema: object, toolName: string): Promise<T> {
  const res = await withRetry(() => anthropic().messages.create({
    model,
    max_tokens: 1024,
    system,
    tools: [{ name: toolName, description: `Return ${toolName}`, input_schema: schema as never }],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: user }],
  }));
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Model did not return structured output");
  return block.input as T;
}

export async function analyzeMessage(message: string, history: { author: string; body: string }[] = []): Promise<MessageAnalysis> {
  const system = [
    "You are the intelligence layer of Growth Inspector, a Saudi social media AI.",
    "Classify the customer's latest message. You understand Saudi Arabic dialects (Khaleeji/Najdi), Arabizi, MSA, English, and code-switching.",
    "Set hard_block=true if the message touches any of these topics, because they must be handled by a human in Saudi Arabia:",
    ...HARD_BLOCK_TOPICS.map((t) => `  - ${t}`),
  ].join("\n");
  const convo = history.slice(-6).map((m) => `${m.author}: ${m.body}`).join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Latest customer message:\n${message}`;
  return structured<MessageAnalysis>(MODELS.reply, system, user, ANALYSIS_SCHEMA, "classify");
}

export async function generateReply(
  message: string,
  analysis: MessageAnalysis,
  voice: BrandVoice,
  history: { author: string; body: string }[] = [],
  channel: "text" | "voice" = "text",
  customerName?: string | null,
): Promise<{ reply: string; confidence: number }> {
  const name = customerName?.trim();
  const identityRule = name
    ? `6. The customer's name is "${name}". Address them naturally by their first name when it fits, and never use any other name.`
    : "6. You do NOT know the customer's name — never invent, guess, or use a placeholder name; address them politely without one.";
  const system = [
    "You are Growth Inspector replying to a customer on social media for a Saudi business.",
    "CRITICAL RULES:",
    "1. Reply in the EXACT same language and dialect register the customer used.",
    `   (detected: ${analysis.language}). If they wrote Khaleeji dialect, reply in Khaleeji.`,
    "   If they wrote Arabizi, reply in natural Arabic (script) unless they clearly prefer Latin.",
    "2. Match the brand voice below precisely.",
    "3. Be warm, concise, and helpful. Respect Saudi etiquette and culture.",
    "4. Never invent prices, policies, or commitments not in the business facts.",
    "5. If you are not sure, lower your confidence score rather than guessing.",
    identityRule,
    ...(channel === "voice" ? ["7. This reply will be SPOKEN ALOUD on a live phone call: 1-3 short natural sentences, no emoji, no markdown, no bullet lists, no headings."] : []),
    "",
    "BRAND VOICE:",
    brandVoiceBlock(voice),
  ].join("\n");
  const convo = history.slice(-6).map((m) => `${m.author}: ${m.body}`).join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Customer just said:\n${message}\n\nWrite the reply.`;
  return structured<{ reply: string; confidence: number }>(MODELS.reply, system, user, REPLY_SCHEMA, "compose_reply");
}

type ResponderOpts = {
  voice: BrandVoice;
  replyMode: "autonomous" | "approval" | "off";
  threshold: number;
  history?: { author: string; body: string }[];
  channel?: "text" | "voice";
  customerName?: string | null;
};

const COMBINED_RESULT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["price_inquiry", "complaint", "hot_lead", "spam", "support", "other"] },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    language: { type: "string", enum: ["ar", "ar-dialect", "arabizi", "en", "mixed"] },
    lead_score: { type: "number" },
    hard_block: { type: "boolean" },
    hard_block_reason: { type: "string" },
    reply: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["intent", "sentiment", "language", "lead_score", "hard_block", "hard_block_reason", "reply", "confidence"],
  additionalProperties: false,
} as const;

function decideAction(
  analysis: MessageAnalysis,
  confidence: number,
  replyMode: "autonomous" | "approval" | "off",
  threshold: number,
): Pick<ResponderResult, "decision" | "escalation_reason"> {
  if (replyMode === "off") return { decision: "draft" };
  if (confidence < threshold) return { decision: "escalate", escalation_reason: "low_confidence" };
  if (analysis.intent === "hot_lead" || analysis.lead_score >= 80) {
    return { decision: "escalate", escalation_reason: "high_intent" };
  }
  return { decision: replyMode === "autonomous" ? "send" : "draft" };
}

function buildCombinedPrompt(message: string, opts: ResponderOpts) {
  const history = opts.history ?? [];
  const convo = history.slice(-6).map((m) => `${m.author}: ${m.body}`).join("\n");
  const name = opts.customerName?.trim();
  const identityLine = name
    ? `The customer's name is "${name}". Address them naturally by their first name when it fits. Do NOT use any other name.`
    : "You do NOT know the customer's name. Never invent, guess, or use a placeholder name — address them politely without one.";
  const system = [
    "You are the intelligence layer of Growth Inspector, a Saudi social media AI.",
    "Understand Saudi Arabic dialects (Khaleeji/Najdi), Arabizi, MSA, English, and code-switching.",
    "Classify the message AND draft the reply in one pass.",
    "",
    "Reply rules:",
    "- Reply in the EXACT same language and dialect register the customer used.",
    "- Be warm, concise, and helpful; respect Saudi etiquette and culture.",
    "- Never invent prices, policies, or commitments not in the brand facts below.",
    "- If unsure, lower your confidence score rather than guessing.",
    ...(opts.channel === "voice" ? ["- This reply is SPOKEN on a phone call: 1-3 short natural sentences, no emoji/markdown."] : []),
    `- ${identityLine}`,
    "",
    `Brand voice:\n${brandVoiceBlock(opts.voice)}`,
    "",
    "Set hard_block=true for: " + HARD_BLOCK_TOPICS.join("; ") + ". These need a human — leave reply empty.",
    "If intent is spam, leave reply empty.",
  ].join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Latest customer message:\n${message}`;
  return { system, user };
}

function finalizeCombinedResult(parsed: MessageAnalysis & { reply: string; confidence: number }, opts: ResponderOpts): ResponderResult {
  const analysis: MessageAnalysis = {
    intent: parsed.intent,
    sentiment: parsed.sentiment,
    language: parsed.language,
    lead_score: parsed.lead_score,
    hard_block: parsed.hard_block,
    hard_block_reason: parsed.hard_block_reason,
  };

  if (analysis.hard_block) {
    return { analysis, reply: "", confidence: 0, decision: "escalate", escalation_reason: "hard_block_topic" };
  }
  if (analysis.intent === "spam") {
    return { analysis, reply: "", confidence: 0, decision: "draft" };
  }

  const { decision, escalation_reason } = decideAction(analysis, parsed.confidence, opts.replyMode, opts.threshold);
  return { analysis, reply: parsed.reply, confidence: parsed.confidence, decision, escalation_reason };
}

export async function respond(
  message: string,
  opts: {
    voice: BrandVoice;
    replyMode: "autonomous" | "approval" | "off";
    threshold: number;
    history?: { author: string; body: string }[];
    channel?: "text" | "voice";
    customerName?: string | null;
  },
): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);
  const parsed = await structured<MessageAnalysis & { reply: string; confidence: number }>(MODELS.reply, system, user, COMBINED_RESULT_SCHEMA, "respond");
  return finalizeCombinedResult(parsed, opts);
}

export async function respondWithGemini(message: string, opts: ResponderOpts): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);
  const res = await withRetry(() => gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    config: { responseMimeType: "application/json", responseSchema: COMBINED_RESULT_SCHEMA as never },
  }));
  const parsed = JSON.parse(res.text ?? "{}") as MessageAnalysis & { reply: string; confidence: number };
  return finalizeCombinedResult(parsed, opts);
}

const COMBINED_JSON_SPEC = [
  "",
  'Respond with ONLY a JSON object, no prose, with exactly these keys:',
  '{"intent": "price_inquiry|complaint|hot_lead|spam|support|other",',
  ' "sentiment": "positive|neutral|negative",',
  ' "language": "ar|ar-dialect|arabizi|en|mixed",',
  ' "lead_score": 0-100 integer,',
  ' "hard_block": true|false,',
  ' "hard_block_reason": string (empty if none),',
  ' "reply": string (the customer-facing reply, empty if hard_block or spam),',
  ' "confidence": 0-1 number}',
].join("\n");

export async function respondWithOpenRouter(message: string, opts: ResponderOpts, model: string): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);
  const parsed = await withRetry(() => openrouterChatJSON<MessageAnalysis & { reply: string; confidence: number }>({ model, system: system + COMBINED_JSON_SPEC, user }));
  return finalizeCombinedResult(parsed, opts);
}

export async function respondWithZai(message: string, opts: ResponderOpts): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);
  const parsed = await withRetry(() => zaiChatJSON<MessageAnalysis & { reply: string; confidence: number }>({ system: system + COMBINED_JSON_SPEC, user }));
  return finalizeCombinedResult(parsed, opts);
}

export class AIUnavailableError extends Error {
  constructor(message = "AI service is temporarily unavailable. Please try again shortly.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export async function respondBestAvailable(
  message: string,
  opts: {
    voice: BrandVoice;
    replyMode: "autonomous" | "approval" | "off";
    threshold: number;
    history?: { author: string; body: string }[];
    channel?: "text" | "voice";
    customerName?: string | null;
  },
): Promise<ResponderResult> {
  let lastErr: unknown;
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await respond(message, opts); } catch (err) { console.error("Claude responder failed, falling back:", err); lastErr = err; }
  }
  if (zaiConfigured()) {
    try { return await respondWithZai(message, opts); } catch (err) { console.error("z.ai responder failed, falling back:", err); lastErr = err; }
  }
  if (openrouterConfigured()) {
    try { return await respondWithOpenRouter(message, opts, OPENROUTER_MODEL_A); } catch (err) { console.error(`OpenRouter (${OPENROUTER_MODEL_A}) failed, falling back:`, err); lastErr = err; }
  }
  if (geminiConfigured()) {
    try { return await respondWithGemini(message, opts); } catch (err) { console.error("Gemini responder failed, falling back:", err); lastErr = err; }
  }
  if (openrouterConfigured()) {
    try { return await respondWithOpenRouter(message, opts, OPENROUTER_MODEL_B); } catch (err) { console.error(`OpenRouter (${OPENROUTER_MODEL_B}) failed:", err); lastErr = err; }
  }
  console.error("No AI provider available:", lastErr);
  throw new AIUnavailableError();
}
