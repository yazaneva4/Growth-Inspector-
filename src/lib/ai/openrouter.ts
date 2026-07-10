/** OpenRouter — optional last-resort responder provider, used only if both
 *  Claude and Gemini fail. OpenAI-compatible API. The model is configurable
 *  via OPENROUTER_MODEL so you can paste the exact slug from openrouter.ai
 *  (e.g. "google/gemma-4-31b-it:free"). Requires OPENROUTER_API_KEY.
 *
 *  NOTE: free ("...:free") endpoints may log prompts/outputs for training —
 *  only point OPENROUTER_MODEL at a zero-data-retention or paid endpoint if
 *  real customer messages must stay private. */
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "google/gemma-4-31b-it:free";

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Chat completion returning parsed JSON. Asks for a JSON object (works
 *  across models that don't support strict json_schema) and parses the
 *  first JSON block from the response defensively. */
export async function openrouterChatJSON<T>(opts: {
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
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");

  // Some models wrap JSON in prose or ```json fences — extract the object.
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : content) as T;
}
