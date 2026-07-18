/** z.ai (Zhipu GLM) — OpenAI-compatible provider, slotted in as the first
 *  fallback after Claude. Requires ZAI_API_KEY. Model configurable via
 *  ZAI_MODEL (defaults to glm-4.6, Zhipu's flagship). */

export const ZAI_MODEL = process.env.ZAI_MODEL?.trim() || "glm-4.6";

const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";

export function zaiConfigured(): boolean {
  return Boolean(process.env.ZAI_API_KEY);
}

async function zaiChat(opts: {
  system: string;
  user: string;
  json: boolean;
}): Promise<string> {
  const res = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ZAI_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`z.ai (${ZAI_MODEL}) request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error(`z.ai (${ZAI_MODEL}) returned no content`);
  return content;
}

/** Chat completion returning parsed JSON (defensive extraction of the first
 *  JSON object, in case the model wraps it in prose). */
export async function zaiChatJSON<T>(opts: { system: string; user: string }): Promise<T> {
  const content = await zaiChat({ ...opts, json: true });
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : content) as T;
}

/** Plain-text chat completion — for free-form copy (e.g. welcome messages). */
export async function zaiChatText(opts: { system: string; user: string }): Promise<string> {
  return (await zaiChat({ ...opts, json: false })).trim();
}
