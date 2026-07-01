import { NextRequest, NextResponse } from "next/server";
import {
  handleVoiceTurn,
  buildTwiml,
  verifyTwilioSignature,
  transcribeWithWhisper,
} from "@/lib/voice";

/**
 * Twilio calls this after each listening step completes: with a transcribed
 * SpeechResult (Twilio's built-in recognizer), or a RecordingUrl to transcribe
 * ourselves via Whisper (when OPENAI_API_KEY + Twilio credentials are set) —
 * empty/short in both cases if the caller said nothing before the timeout.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(req.url, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const toNumber = params.To ?? "";
  const fromNumber = params.From ?? "";

  let speech = params.SpeechResult ?? "";
  if (!speech && params.RecordingUrl) {
    const durationSec = Number(params.RecordingDuration ?? "0");
    if (durationSec >= 1) {
      try {
        speech = await transcribeWithWhisper(params.RecordingUrl);
      } catch (err) {
        console.error("whisper transcription failed", err);
      }
    }
  }

  const turn = await handleVoiceTurn({ toNumber, fromNumber, speech });
  const gatherUrl = new URL("/api/voice/gather", req.url).toString();
  const twiml = buildTwiml(turn, gatherUrl);

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
