import type { SocialPlatform } from "@/lib/types";

/** A normalized inbound event, whatever platform it came from. */
export interface InboundMessage {
  platform: SocialPlatform;
  accountExternalId: string; // which connected account received it
  customerHandle: string;
  customerName?: string;
  body: string;
  receivedAt: string;
}

/** Each platform implements ingest (webhook → normalized) + send. */
export interface PlatformAdapter {
  platform: SocialPlatform;
  /** Parse a raw platform webhook payload into normalized messages. */
  parseWebhook(payload: unknown): InboundMessage[];
  /** Deliver an outbound reply back to the customer on the platform. */
  send(accountExternalId: string, customerHandle: string, body: string): Promise<void>;
}

/**
 * Sandbox adapter — lets the whole pipeline run end-to-end without live
 * platform credentials. Real WhatsApp/Instagram adapters slot in here
 * with the same interface once business accounts are verified (SPEC §5).
 */
export const sandboxAdapter: PlatformAdapter = {
  platform: "sandbox",
  parseWebhook(payload: unknown): InboundMessage[] {
    const p = payload as Partial<InboundMessage> & { body?: string };
    if (!p?.body) return [];
    return [
      {
        platform: "sandbox",
        accountExternalId: p.accountExternalId ?? "sandbox-account",
        customerHandle: p.customerHandle ?? "sandbox-customer",
        customerName: p.customerName,
        body: p.body,
        receivedAt: new Date().toISOString(),
      },
    ];
  },
  async send(accountExternalId, customerHandle, body) {
    // In the sandbox we just log; the reply is persisted in the DB and shown
    // in the inbox UI. Real adapters call the platform send API here.
    console.log(
      `[sandbox] -> ${customerHandle} via ${accountExternalId}: ${body}`,
    );
  },
};

/**
 * Stub for WhatsApp Business — structure only. Wire the Cloud API
 * (graph.facebook.com /messages, approved templates, 24h window) when a
 * verified WABA is available.
 */
export const whatsappAdapter: PlatformAdapter = {
  platform: "whatsapp",
  parseWebhook(payload: unknown): InboundMessage[] {
    // Meta wraps messages in entry[].changes[].value.messages[].
    const messages: InboundMessage[] = [];
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries as Array<{ changes?: unknown[] }>) {
      for (const change of (entry.changes ?? []) as Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<{ from?: string; text?: { body?: string } }>;
        };
      }>) {
        const value = change.value;
        const accountId = value?.metadata?.phone_number_id ?? "";
        for (const m of value?.messages ?? []) {
          if (!m.text?.body) continue;
          messages.push({
            platform: "whatsapp",
            accountExternalId: accountId,
            customerHandle: m.from ?? "",
            customerName: value?.contacts?.[0]?.profile?.name,
            body: m.text.body,
            receivedAt: new Date().toISOString(),
          });
        }
      }
    }
    return messages;
  },
  async send() {
    throw new Error("WhatsApp adapter not yet configured — needs verified WABA");
  },
};

/**
 * Email channel. Accepts a normalized inbound-email payload compatible with
 * common inbound-parse providers (Postmark, SendGrid, Mailgun): { from,
 * fromName, subject, text, to }. The customer's email address is the handle so
 * replies thread by sender. Sending is wired to a provider's API in prod.
 */
export const emailAdapter: PlatformAdapter = {
  platform: "email",
  parseWebhook(payload: unknown): InboundMessage[] {
    const p = (payload ?? {}) as {
      from?: string;
      From?: string;
      sender?: string;
      fromName?: string;
      FromName?: string;
      subject?: string;
      Subject?: string;
      text?: string;
      TextBody?: string;
      "body-plain"?: string;
      to?: string;
      To?: string;
      mailbox?: string;
    };
    const from = p.from ?? p.From ?? p.sender;
    const body = p.text ?? p.TextBody ?? p["body-plain"];
    if (!from || !body) return [];
    const subject = p.subject ?? p.Subject;
    return [
      {
        platform: "email",
        accountExternalId: p.to ?? p.To ?? p.mailbox ?? "support-inbox",
        customerHandle: from,
        customerName: p.fromName ?? p.FromName,
        body: subject ? `${subject}\n\n${body}` : body,
        receivedAt: new Date().toISOString(),
      },
    ];
  },
  async send(accountExternalId, customerHandle, body) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "Growth Inspector <onboarding@resend.dev>";
    if (!apiKey) {
      // No provider configured — log so the demo still works end to end.
      console.log(`[email:dryrun] -> ${customerHandle}: ${body}`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: customerHandle,
        subject: "Re: your message",
        text: body,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    }
  },
};

const ADAPTERS: Record<string, PlatformAdapter> = {
  sandbox: sandboxAdapter,
  whatsapp: whatsappAdapter,
  email: emailAdapter,
};

export function getAdapter(platform: SocialPlatform): PlatformAdapter {
  const a = ADAPTERS[platform];
  if (!a) throw new Error(`No adapter for platform: ${platform}`);
  return a;
}
