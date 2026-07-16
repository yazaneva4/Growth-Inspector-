import { anthropic, MODELS } from "./anthropic";
import { gemini, geminiConfigured, GEMINI_MODEL } from "./gemini";
import {
  openrouterChatText,
  openrouterConfigured,
  OPENROUTER_MODEL_A,
  OPENROUTER_MODEL_B,
} from "./openrouter";

/** Thrown when no AI provider is configured or every tier fails. */
export class ComposeUnavailableError extends Error {
  constructor() {
    super("No AI provider is available to compose this message.");
    this.name = "ComposeUnavailableError";
  }
}

/**
 * Free-form text generation over the same open-source-friendly fallback chain
 * the responder uses — Claude → OpenRouter Tier A → Gemini → OpenRouter Tier B.
 * Returns plain text (no JSON). Each provider is tried in turn; the first that
 * succeeds wins, so the app keeps working even if only the free OpenRouter /
 * Gemini tiers are configured.
 */
export async function composeText(opts: {
  system: string;
  user: string;
}): Promise<string> {
  let lastErr: unknown;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const msg = await anthropic().messages.create({
        model: MODELS.reply,
        max_tokens: 600,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });
      const text = msg.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (text) return text;
    } catch (err) {
      console.error("Claude compose failed, falling back:", err);
      lastErr = err;
    }
  }

  if (openrouterConfigured()) {
    try {
      return await openrouterChatText({ model: OPENROUTER_MODEL_A, ...opts });
    } catch (err) {
      console.error(`OpenRouter (${OPENROUTER_MODEL_A}) compose failed, falling back:`, err);
      lastErr = err;
    }
  }

  if (geminiConfigured()) {
    try {
      const res = await gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: `${opts.system}\n\n${opts.user}`,
      });
      const text = res.text?.trim();
      if (text) return text;
    } catch (err) {
      console.error("Gemini compose failed, falling back:", err);
      lastErr = err;
    }
  }

  if (openrouterConfigured()) {
    try {
      return await openrouterChatText({ model: OPENROUTER_MODEL_B, ...opts });
    } catch (err) {
      console.error(`OpenRouter (${OPENROUTER_MODEL_B}) compose failed:`, err);
      lastErr = err;
    }
  }

  console.error("No AI provider available to compose text:", lastErr);
  throw new ComposeUnavailableError();
}
