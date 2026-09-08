/** OpenCode Zen free Big Pickle integration. */

export const OPENCODE_MODEL = "big-pickle";
const OPENCODE_URL = "https://opencode.ai/zen/v1/chat/completions";

export function opencodeConfigured(): boolean {
  // The route is available only when a Zen credential is configured.
  // Big Pickle itself is the only OpenCode model this app is allowed to call.
  return Boolean(process.env.OPENCODE_API_KEY?.trim());
}

async function request(body: Record<string, unknown>) {
  const key = process.env.OPENCODE_API_KEY?.trim();
  if (!key) throw new Error("OpenCode Zen is not configured.");
  const res = await fetch(OPENCODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "User-Agent": "Growth-Inspector/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenCode Big Pickle request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function opencodeChatJSON<T>(opts: { system: string; user: string }): Promise<T> {
  const data = await request({
    model: OPENCODE_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  });
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenCode Big Pickle returned no content");
  const match = content.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : content) as T;
}

export async function opencodeChatText(opts: { system: string; user: string }): Promise<string> {
  const data = await request({
    model: OPENCODE_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenCode Big Pickle returned no content");
  return content.trim();
}
