/** ChatGPT (OpenAI) — third responder provider, kicks in if Claude is rate-
 *  limited/unavailable and before falling back to Gemini. Uses the same
 *  OPENAI_API_KEY already configured for Whisper voice transcription. */
export const OPENAI_MODEL = "gpt-4o-mini";

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Chat completion constrained to a JSON schema via OpenAI's structured outputs. */
export async function openaiChatJSON<T>(opts: {
  system: string;
  user: string;
  schema: object;
  schemaName: string;
}): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return JSON.parse(content) as T;
}
