import { NextRequest, NextResponse } from "next/server";
import { handleVoiceTurn, buildTwiml, verifyTwilioSignature } from "@/lib/voice";

/**
 * Twilio calls this after each <Gather> completes — with the transcribed
 * SpeechResult, or empty if the caller said nothing before the timeout.
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
  const speech = params.SpeechResult ?? "";

  const turn = await handleVoiceTurn({ toNumber, fromNumber, speech });
  const gatherUrl = new URL("/api/voice/gather", req.url).toString();
  const twiml = buildTwiml(turn, gatherUrl);

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
