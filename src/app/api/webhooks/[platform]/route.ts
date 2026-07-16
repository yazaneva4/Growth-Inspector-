import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
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

/** Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the
 *  app secret). Only enforced when META_APP_SECRET is configured, so setups
 *  without it still work. Returns true when there's nothing to check. */
function metaSignatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true; // not configured → skip verification
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const provided = header.slice("sha256=".length);
  // Constant-time compare; guard against length mismatch throwing.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  // Read the raw body once so we can both verify the signature and parse it.
  const rawBody = await req.text();

  if (!metaSignatureValid(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
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
  // Process sequentially; in prod this would enqueue to a job queue. Each
  // message is isolated in its own try/catch — a single failure must not
  // fail the whole webhook, or Meta will retry and eventually DISABLE the
  // subscription, cutting off all inbound. Always ack with 200.
  let processed = 0;
  for (const m of messages) {
    try {
      await handleInbound(m);
      processed++;
    } catch (err) {
      console.error(`Webhook message from ${m.customerHandle} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, received: messages.length, processed });
}
