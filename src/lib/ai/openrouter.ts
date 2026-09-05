/** OpenRouter integration for Growth AI.
 *
 * The primary OpenRouter option is OpenRouter's official Free Models Router
 * (`openrouter/free`). It dynamically selects an eligible free model for each
 * request, so Growth AI does not need a hard-coded list of free model slugs.
 *
 * Free-model responses should not be used for sensitive customer data unless
 * the selected OpenRouter/provider policy is appropriate for that data.
 */

/** Tier A — OpenRouter's official free-model router. */
export const OPENROUTER_MODEL_A =
  process.env.OPENROUTER_MODEL_A?.trim() || "openrouter/free";

/** Tier B — explicit free-model fallback if the router itself is unavailable. */
export const OPENROUTER_MODEL_B =
  process.env.OPENROUTER_MODEL_B?.trim() || "openai/gpt-oss-20b:free";

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Chat completion returning parsed JSON. Asks for a JSON object (works
 * across models that don't support strict json_schema) and parses the
 * first JSON block from the response defensively. */
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
      "HTTP-Referer": "https://growth-inspector-yazaneva4-3470s-projects.vercel.app",
      "X-Title": "Growth Inspector",
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

  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : content) as T;
}

/** Plain-text chat completion — for Growth AI free-form responses. */
export async function openrouterChatText(opts: {
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://growth-inspector-yazaneva4-3470s-projects.vercel.app",
      "X-Title": "Growth Inspector",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter (${opts.model}) request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error(`OpenRouter (${opts.model}) returned no content`);
  return content.trim();
}
