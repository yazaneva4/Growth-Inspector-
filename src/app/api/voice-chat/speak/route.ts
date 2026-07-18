import { NextRequest, NextResponse } from "next/server";
import { elevenLabsConfigured, elevenLabsTTS } from "@/lib/ai/elevenlabs";

/**
 * Text-to-speech via ElevenLabs. Returns MP3 audio the client plays for the
 * AI's spoken reply. Returns 503 when ElevenLabs isn't configured so the
 * client can fall back to the browser's built-in speech synthesis.
 */
export async function POST(req: NextRequest) {
  if (!elevenLabsConfigured()) {
    return NextResponse.json({ error: "elevenlabs not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const text = (body?.text as string | undefined)?.trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  // Guard against very long inputs (ElevenLabs bills per character).
  const clipped = text.slice(0, 1500);

  try {
    const audio = await elevenLabsTTS(clipped);
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("ElevenLabs TTS error:", err);
    return NextResponse.json({ error: "tts failed" }, { status: 502 });
  }
}
