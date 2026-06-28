import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/platforms/adapter";
import { handleInbound } from "@/lib/orchestrator";
import type { SocialPlatform } from "@/lib/types";

/**
 * Per-platform webhook ingestion. Meta (WhatsApp/Instagram) verifies the
 * webhook with a GET challenge; we echo hub.challenge back.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const challenge = params.get("hub.challenge");
  const verifyToken = params.get("hub.verify_token");
  if (challenge && verifyToken === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let adapter;
  try {
    adapter = getAdapter(platform as SocialPlatform);
  } catch {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }

  const messages = adapter.parseWebhook(payload);
  // Process sequentially; in prod this would enqueue to a job queue.
  const results = [];
  for (const m of messages) {
    results.push(await handleInbound(m));
  }

  return NextResponse.json({ ok: true, processed: messages.length, results });
}
