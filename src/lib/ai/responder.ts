import { anthropic, MODELS } from "./anthropic";
import { gemini, geminiConfigured, GEMINI_MODEL } from "./gemini";
import {
  openrouterChatJSON,
  openrouterConfigured,
  OPENROUTER_MODEL_A,
  OPENROUTER_MODEL_B,
  OPENROUTER_MODEL_C,
} from "./openrouter";
import { withRetry } from "./retry";
import type { BrandVoice, Intent, Language } from "@/lib/types";

/** Topics the responder must never engage — hard-escalate to a human. */
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
  lead_score: number; // 0-100
  hard_block: boolean;
  hard_block_reason?: string;
}

export interface ResponderResult {
  analysis: MessageAnalysis;
  reply: string;
  confidence: number; // 0-1
  /** What the orchestrator should do given org reply_mode + threshold. */
  decision: "send" | "draft" | "escalate";
  escalation_reason?: "low_confidence" | "hard_block_topic" | "high_intent";
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "price_inquiry",
        "complaint",
        "hot_lead",
        "spam",
        "support",
        "other",
      ],
    },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    language: {
      type: "string",
      enum: ["ar", "ar-dialect", "arabizi", "en", "mixed"],
      description:
        "ar = MSA, ar-dialect = Khaleeji/Najdi Arabic script, arabizi = Arabic in Latin letters/numbers, en = English, mixed = code-switched",
    },
    lead_score: { type: "number", description: "0-100 buying intent" },
    hard_block: {
      type: "boolean",
      description: "true if the message touches a hard-block topic",
    },
    hard_block_reason: { type: "string" },
  },
  required: ["intent", "sentiment", "language", "lead_score", "hard_block"],
  additionalProperties: false,
} as const;

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "The customer-facing reply, in the SAME language/dialect/register as the customer wrote in.",
    },
    confidence: {
      type: "number",
      description:
        "0-1 self-assessed confidence that this reply is correct, safe, and on-brand.",
    },
  },
  required: ["reply", "confidence"],
  additionalProperties: false,
} as const;

function brandVoiceBlock(voice: BrandVoice): string {
  const parts: string[] = [];
  if (voice.tone) parts.push(`Tone: ${voice.tone}`);
  if (voice.facts) parts.push(`Business facts you may use:\n${voice.facts}`);
  if (voice.guardrails?.length)
    parts.push(`Never: ${voice.guardrails.join("; ")}`);
  if (voice.examples?.length) {
    parts.push(
      "Imitate the dialect and style of these past replies:\n" +
        voice.examples
          .map((e) => `Customer: ${e.customer}\nReply: ${e.reply}`)
          .join("\n---\n"),
    );
  }
  return parts.join("\n\n") || "(no brand voice configured yet)";
}

async function structured<T>(
  model: string,
  system: string,
  user: string,
  schema: object,
  toolName: string,
): Promise<T> {
  const res = await withRetry(() =>
    anthropic().messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: [{ name: toolName, description: `Return ${toolName}`, input_schema: schema as never }],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: user }],
    }),
  );
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }
  return block.input as T;
}

/** First pass: classify the inbound message + detect hard-block topics. */
export async function analyzeMessage(
  message: string,
  history: { author: string; body: string }[] = [],
): Promise<MessageAnalysis> {
  const system = [
    "You are the intelligence layer of Growth Inspector, a Saudi social media AI.",
    "Classify the customer's latest message. You understand Saudi Arabic dialects",
    "(Khaleeji/Najdi), Arabizi (Arabic written in Latin letters/numbers like '3ndk 7aga'),",
    "MSA, English, and code-switching.",
    "",
    "Set hard_block=true if the message touches any of these topics, because they",
    "must be handled by a human in Saudi Arabia:",
    ...HARD_BLOCK_TOPICS.map((t) => `  - ${t}`),
  ].join("\n");

  const convo = history
    .slice(-6)
    .map((m) => `${m.author}: ${m.body}`)
    .join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Latest customer message:\n${message}`;

  return structured<MessageAnalysis>(
    MODELS.reply,
    system,
    user,
    ANALYSIS_SCHEMA,
    "classify",
  );
}

/** Second pass: generate the dialect-matched, brand-voiced reply. */
export async function generateReply(
  message: string,
  analysis: MessageAnalysis,
  voice: BrandVoice,
  history: { author: string; body: string }[] = [],
  channel: "text" | "voice" = "text",
): Promise<{ reply: string; confidence: number }> {
  const system = [
    "You are Growth Inspector replying to a customer on social media for a Saudi business.",
    "CRITICAL RULES:",
    "1. Reply in the EXACT same language and dialect register the customer used",
    `   (detected: ${analysis.language}). If they wrote Khaleeji dialect, reply in Khaleeji.`,
    "   If they wrote Arabizi, reply in natural Arabic (script) unless they clearly prefer Latin.",
    "2. Match the brand voice below precisely.",
    "3. Be warm, concise, and helpful. Respect Saudi etiquette and culture.",
    "4. Never invent prices, policies, or commitments not in the business facts.",
    "5. If you are not sure, lower your confidence score rather than guessing.",
    ...(channel === "voice"
      ? [
          "6. This reply will be SPOKEN ALOUD on a live phone call: 1-3 short",
          "   natural sentences, no emoji, no markdown, no bullet lists, no",
          "   headings — plain spoken language only, as if talking to the caller.",
        ]
      : []),
    "",
    "BRAND VOICE:",
    brandVoiceBlock(voice),
  ].join("\n");

  const convo = history
    .slice(-6)
    .map((m) => `${m.author}: ${m.body}`)
    .join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Customer just said:\n${message}\n\nWrite the reply.`;

  return structured<{ reply: string; confidence: number }>(
    MODELS.reply,
    system,
    user,
    REPLY_SCHEMA,
    "compose_reply",
  );
}

/**
 * Full pipeline: analyze → guardrail → generate → decide.
 * `replyMode` and `threshold` come from the org config.
 */
export async function respond(
  message: string,
  opts: {
    voice: BrandVoice;
    replyMode: "autonomous" | "approval" | "off";
    threshold: number;
    history?: { author: string; body: string }[];
    channel?: "text" | "voice";
  },
): Promise<ResponderResult> {
  const history = opts.history ?? [];
  const analysis = await analyzeMessage(message, history);

  // Guardrail: hard-block topics never auto-send.
  if (analysis.hard_block || analysis.intent === "spam") {
    return {
      analysis,
      reply: "",
      confidence: 0,
      decision: analysis.intent === "spam" ? "draft" : "escalate",
      escalation_reason: analysis.hard_block ? "hard_block_topic" : undefined,
    };
  }

  const { reply, confidence } = await generateReply(
    message,
    analysis,
    opts.voice,
    history,
    opts.channel ?? "text",
  );

  const { decision, escalation_reason } = decideAction(analysis, confidence, opts.replyMode, opts.threshold);
  return { analysis, reply, confidence, decision, escalation_reason };
}

/** Shared send/draft/escalate matrix used by every provider. */
function decideAction(
  analysis: MessageAnalysis,
  confidence: number,
  replyMode: "autonomous" | "approval" | "off",
  threshold: number,
): Pick<ResponderResult, "decision" | "escalation_reason"> {
  if (replyMode === "off") return { decision: "draft" };
  if (confidence < threshold) return { decision: "escalate", escalation_reason: "low_confidence" };
  if (analysis.intent === "hot_lead" || analysis.lead_score >= 80) {
    // High-value leads always get a human eye even when confident.
    return { decision: replyMode === "autonomous" ? "send" : "draft", escalation_reason: "high_intent" };
  }
  return { decision: replyMode === "autonomous" ? "send" : "draft" };
}

const COMBINED_RESULT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["price_inquiry", "complaint", "hot_lead", "spam", "support", "other"] },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    language: { type: "string", enum: ["ar", "ar-dialect", "arabizi", "en", "mixed"] },
    lead_score: { type: "number" },
    hard_block: { type: "boolean" },
    hard_block_reason: { type: "string" },
    reply: {
      type: "string",
      description: "Customer-facing reply in the SAME language/dialect the customer used. Empty string if hard_block or spam.",
    },
    confidence: { type: "number", description: "0-1 self-assessed confidence in the reply." },
  },
  required: ["intent", "sentiment", "language", "lead_score", "hard_block", "hard_block_reason", "reply", "confidence"],
  additionalProperties: false,
} as const;

type ResponderOpts = {
  voice: BrandVoice;
  replyMode: "autonomous" | "approval" | "off";
  threshold: number;
  history?: { author: string; body: string }[];
  channel?: "text" | "voice";
};

/** Prompt for the single-call Gemini fallback provider: classify + draft
 *  the reply together, instead of two separate calls. */
function buildCombinedPrompt(message: string, opts: ResponderOpts) {
  const history = opts.history ?? [];
  const convo = history.slice(-6).map((m) => `${m.author}: ${m.body}`).join("\n");
  const system = [
    "You are the intelligence layer of Growth Inspector, a Saudi social media AI.",
    "Understand Saudi Arabic dialects (Khaleeji/Najdi), Arabizi, MSA, English, and code-switching.",
    "Classify the message AND draft the reply in one pass.",
    "",
    `Brand voice:\n${brandVoiceBlock(opts.voice)}`,
    "",
    "Set hard_block=true for: " + HARD_BLOCK_TOPICS.join("; ") + ". These need a human — leave reply empty.",
    "If intent is spam, leave reply empty.",
  ].join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Latest customer message:\n${message}`;
  return { system, user };
}

/** Turns a parsed combined-schema result into a ResponderResult, applying
 *  the same hard-block guardrail and decision matrix as the Claude path. */
function finalizeCombinedResult(
  parsed: MessageAnalysis & { reply: string; confidence: number },
  opts: ResponderOpts,
): ResponderResult {
  const analysis: MessageAnalysis = {
    intent: parsed.intent,
    sentiment: parsed.sentiment,
    language: parsed.language,
    lead_score: parsed.lead_score,
    hard_block: parsed.hard_block,
    hard_block_reason: parsed.hard_block_reason,
  };

  if (analysis.hard_block || analysis.intent === "spam") {
    return {
      analysis,
      reply: "",
      confidence: 0,
      decision: analysis.intent === "spam" ? "draft" : "escalate",
      escalation_reason: analysis.hard_block ? "hard_block_topic" : undefined,
    };
  }

  const { decision, escalation_reason } = decideAction(analysis, parsed.confidence, opts.replyMode, opts.threshold);
  return { analysis, reply: parsed.reply, confidence: parsed.confidence, decision, escalation_reason };
}

/**
 * Gemini-backed pipeline (fallback provider): does classification + reply
 * generation in one call for efficiency, then applies the same decision
 * matrix as the Claude path so callers see an identical ResponderResult shape.
 */
export async function respondWithGemini(
  message: string,
  opts: ResponderOpts,
): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);

  const res = await withRetry(() =>
    gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: COMBINED_RESULT_SCHEMA as never,
      },
    }),
  );

  const parsed = JSON.parse(res.text ?? "{}") as MessageAnalysis & { reply: string; confidence: number };
  return finalizeCombinedResult(parsed, opts);
}

/**
 * OpenRouter-backed pipeline — takes the target model per call, since
 * OpenRouter fills three separate tiers in the fallback chain. Unlike
 * Gemini, OpenRouter models don't take a schema object, so the required
 * JSON shape is spelled out in the prompt and parsed defensively.
 */
export async function respondWithOpenRouter(
  message: string,
  opts: ResponderOpts,
  model: string,
): Promise<ResponderResult> {
  const { system, user } = buildCombinedPrompt(message, opts);
  const jsonSpec = [
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

  const parsed = await withRetry(() =>
    openrouterChatJSON<MessageAnalysis & { reply: string; confidence: number }>({
      model,
      system: system + jsonSpec,
      user,
    }),
  );
  return finalizeCombinedResult(parsed, opts);
}

/** Thrown when no AI provider could produce a real reply. Callers should
 *  show a friendly "AI is temporarily unavailable" message — never fall
 *  back to canned/demo text as if it were a real reply. */
export class AIUnavailableError extends Error {
  constructor(message = "AI service is temporarily unavailable. Please try again shortly.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/**
 * Provider-selecting entry point — five-tier fallback chain, each step
 * retrying transient failures internally before moving to the next:
 *   1. Claude              (best quality)
 *   2. OpenRouter Tier A    (openai/gpt-oss-120b:free by default)
 *   3. Gemini
 *   4. OpenRouter Tier B    (google/gemma-4-31b-it:free by default)
 *   5. OpenRouter Tier C    (tencent/hy3:free by default — final catch-all)
 * Throws AIUnavailableError if no provider is configured or all fail —
 * never silently returns a demo reply.
 */
export async function respondBestAvailable(
  message: string,
  opts: {
    voice: BrandVoice;
    replyMode: "autonomous" | "approval" | "off";
    threshold: number;
    history?: { author: string; body: string }[];
    channel?: "text" | "voice";
  },
): Promise<ResponderResult> {
  let lastErr: unknown;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await respond(message, opts);
    } catch (err) {
      console.error("Claude responder failed, falling back:", err);
      lastErr = err;
    }
  }
  if (openrouterConfigured()) {
    try {
      return await respondWithOpenRouter(message, opts, OPENROUTER_MODEL_A);
    } catch (err) {
      console.error(`OpenRouter (${OPENROUTER_MODEL_A}) failed, falling back:`, err);
      lastErr = err;
    }
  }
  if (geminiConfigured()) {
    try {
      return await respondWithGemini(message, opts);
    } catch (err) {
      console.error("Gemini responder failed, falling back:", err);
      lastErr = err;
    }
  }
  if (openrouterConfigured()) {
    try {
      return await respondWithOpenRouter(message, opts, OPENROUTER_MODEL_B);
    } catch (err) {
      console.error(`OpenRouter (${OPENROUTER_MODEL_B}) failed, falling back:`, err);
      lastErr = err;
    }
    try {
      return await respondWithOpenRouter(message, opts, OPENROUTER_MODEL_C);
    } catch (err) {
      console.error(`OpenRouter (${OPENROUTER_MODEL_C}) failed:`, err);
      lastErr = err;
    }
  }
  console.error("No AI provider available:", lastErr);
  throw new AIUnavailableError();
}
