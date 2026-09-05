import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { handleInbound } from "@/lib/orchestrator";

function firstString(...values: unknown[]) {
  return values.find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim();
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.INBOX_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) return NextResponse.json({ error: "Inbound email webhook is not configured." }, { status: 503 });
  if (req.headers.get("x-inbox-webhook-secret") !== configuredSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const from = firstString(payload.from, payload.From, payload.sender, payload.sender_email);
  const text = firstString(payload.text, payload.TextBody, payload["body-plain"], payload.body);
  const to = firstString(payload.to, payload.To, payload.recipient, payload.mailbox);
  const subject = firstString(payload.subject, payload.Subject);
  const messageId = firstString(payload.message_id, payload.messageId, payload["Message-ID"]);
  const inReplyTo = firstString(payload.in_reply_to, payload.inReplyTo, payload["In-Reply-To"]);
  const fromName = firstString(payload.fromName, payload.FromName, payload.sender_name);
  if (!from || !text) return NextResponse.json({ error: "from and text are required" }, { status: 400 });

  const result = await handleInbound({
    platform: "email",
    accountExternalId: "support-inbox",
    customerHandle: from.toLowerCase(),
    customerEmail: from.toLowerCase(),
    customerName: fromName,
    body: text,
    subject,
    externalMessageId: messageId,
    inReplyTo,
    receivedAt: new Date().toISOString(),
    mailbox: to,
  }, createServiceClient());

  return NextResponse.json({ ok: true, result });
}
