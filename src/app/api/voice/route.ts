import { NextRequest, NextResponse } from "next/server";
import { greetCaller, buildTwiml, verifyTwilioSignature } from "@/lib/voice";

/**
 * Twilio "Voice URL" — called once when a call comes in. Set this as the
 * webhook on your Twilio phone number: POST https://<app>/api/voice
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

  const turn = await greetCaller({ toNumber, fromNumber });
  const gatherUrl = new URL("/api/voice/gather", req.url).toString();
  const twiml = buildTwiml(turn, gatherUrl);

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
