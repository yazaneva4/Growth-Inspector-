import { NextRequest, NextResponse } from "next/server";
import { respondBestAvailable, AIUnavailableError } from "@/lib/ai/responder";
import type { BrandVoice, ReplyMode } from "@/lib/types";

/**
 * Live demo endpoint: runs the full responder pipeline on a single message
 * without touching the database. Tries Claude, then Gemini — always a real
 * AI-generated reply; never demo/canned text.
 */
const DEMO_VOICE: BrandVoice = {
  tone: "Friendly, warm, professional Saudi brand. Uses light, respectful Khaleeji dialect.",
  facts:
    "Working hours: 10am–10pm Sat–Thu. Delivery across KSA in 2–4 days. Returns within 7 days. We sell premium oud and perfumes.",
  guardrails: ["Never promise discounts not approved by the team"],
  examples: [
    {
      customer: "How much is the oud?",
      reply: "Hello! 🌿 Our oud starts from 250 SAR. Want me to send you the full list?",
    },
  ],
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message: string | undefined = body?.message;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const replyMode: ReplyMode = body?.replyMode ?? "autonomous";
  const threshold: number =
    typeof body?.threshold === "number" ? body.threshold : 0.75;
  const history: { author: string; body: string }[] = body?.history ?? [];

  try {
    const result = await respondBestAvailable(message, {
      voice: DEMO_VOICE,
      replyMode,
      threshold,
      history,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "responder failed", detail: String(err) },
      { status: 500 },
    );
  }
}
