/** ElevenLabs text-to-speech — high-quality AI voice for spoken replies.
 *  Optional: when ELEVENLABS_API_KEY is set the app speaks with ElevenLabs;
 *  otherwise the client falls back to the browser's built-in voice.
 *
 *  ELEVENLABS_VOICE_ID picks the voice (copy it from the voice's page in the
 *  ElevenLabs dashboard). Defaults to "Rachel", a stock multilingual voice.
 *  eleven_multilingual_v2 handles both Arabic and English. */

export const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM"; // Rachel

export const ELEVENLABS_MODEL =
  process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2";

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Synthesize speech and return the raw MP3 audio bytes. */
export async function elevenLabsTTS(text: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  }
  return res.arrayBuffer();
}
