import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { handleInbound } from "@/lib/orchestrator";
import { AIUnavailableError } from "@/lib/ai/responder";

// Allow up to 30s for the AI pipeline (+ fallback tiers) so a slow provider
// doesn't get killed early and surface as a "crash" to the user.
export const maxDuration = 30;

/**
 * Persisting inbox endpoint for the public demo workspace. Routes an inbound
 * message through the full pipeline (analyze → guardrail → reply → decide)
 * AND saves the conversation, messages, and any escalation to Supabase, so
 * the dashboards reflect real activity.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message: string | undefined = body?.message;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const channel: "email" | "sandbox" =
    body?.channel === "email" ? "email" : "sandbox";
  const accountExternalId = channel === "email" ? "support-inbox" : "demo-sandbox";
  const customerHandle: string =
    typeof body?.customerHandle === "string"
      ? body.customerHandle
      : channel === "email"
        ? "visitor@example.com"
        : "demo_visitor";

  const db = createPublicClient();
  try {
    const result = await handleInbound(
      {
        platform: channel,
        accountExternalId,
        customerHandle,
        customerName: body?.customerName,
        body: message,
        receivedAt: new Date().toISOString(),
      },
      db,
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "pipeline failed", detail: String(err) },
      { status: 500 },
    );
  }
}
