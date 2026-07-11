/** OpenRouter — optional responder fallback tiers, slotted between/after
 *  Claude and Gemini. OpenAI-compatible API. Each tier's model slug is
 *  configurable via its own env var so the exact string can be pasted from
 *  openrouter.ai. Requires OPENROUTER_API_KEY (shared across all tiers).
 *
 *  NOTE: free ("...:free") endpoints may log prompts/outputs for training —
 *  only use one for real customer data if it's explicitly zero-data-retention. */

/** Tier A — tried right after Claude fails, before Gemini. */
export const OPENROUTER_MODEL_A =
  process.env.OPENROUTER_MODEL_A?.trim() || "openai/gpt-oss-120b:free";

/** Tier B — tried right after Gemini fails. */
export const OPENROUTER_MODEL_B =
  process.env.OPENROUTER_MODEL_B?.trim() || "google/gemma-4-31b-it:free";

/** Tier C — final fallback, tried after everything else fails.
 *  Going away on OpenRouter July 21, 2026 — swap this before then. */
export const OPENROUTER_MODEL_C =
  process.env.OPENROUTER_MODEL_C?.trim() || "tencent/hy3:free";

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Chat completion returning parsed JSON. Asks for a JSON object (works
 *  across models that don't support strict json_schema) and parses the
 *  first JSON block from the response defensively. */
export async function openrouterChatJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
}): Promise<T> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://growth-space.net",
      "X-Title": "GrowthSpace",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter (${opts.model}) request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter (${opts.model}) returned no content`);

  // Some models wrap JSON in prose or ```json fences — extract the object.
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : content) as T;
}
