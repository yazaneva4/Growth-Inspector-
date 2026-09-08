/** OpenCode Zen free Big Pickle integration. */

export const OPENCODE_MODEL = "big-pickle";
const OPENCODE_URL = "https://opencode.ai/zen/v1/chat/completions";

export function opencodeConfigured(): boolean {
  // Big Pickle is a free OpenCode Zen model and does not require a paid key.
  return true;
}

async function request(body: Record<string, unknown>) {
  const res = await fetch(OPENCODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
