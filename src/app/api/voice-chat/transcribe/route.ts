import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/voice";

/** Transcribes a browser-recorded audio clip (mic input) for the in-dashboard
 *  voice chat feature. Requires OPENAI_API_KEY (same Whisper key used for
 *  call transcription — no Twilio dependency here). */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice transcription isn't configured (missing OPENAI_API_KEY)." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(audio, "voice-chat.webm");
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "transcription failed" },
      { status: 500 },
    );
  }
}
