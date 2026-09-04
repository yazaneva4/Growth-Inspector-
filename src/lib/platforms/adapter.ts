import type { SocialPlatform } from "@/lib/types";
import { sendEmail } from "@/lib/email/send";

export interface InboundMessage {
  platform: SocialPlatform;
  accountExternalId: string;
  customerHandle: string;
  customerName?: string;
  body: string;
  receivedAt: string;
}

export interface PlatformAdapter {
  platform: SocialPlatform;
  parseWebhook(payload: unknown): InboundMessage[];
  send(accountExternalId: string, customerHandle: string, body: string): Promise<void>;
}

export const sandboxAdapter: PlatformAdapter = {
  platform: "sandbox",
  parseWebhook(payload: unknown): InboundMessage[] {
    const p = payload as Partial<InboundMessage> & { body?: string };
    if (!p?.body) return [];
    return [{
      platform: "sandbox",
      accountExternalId: p.accountExternalId ?? "sandbox-account",
      customerHandle: p.customerHandle ?? "sandbox-customer",
      customerName: p.customerName,
      body: p.body,
      receivedAt: new Date().toISOString(),
    }];
  },
  async send(accountExternalId, customerHandle, body) {
    console.log(`[sandbox] -> ${customerHandle} via ${accountExternalId}: ${body}`);
  },
};

export const instagramAdapter: PlatformAdapter = {
  platform: "instagram",
  parseWebhook(payload: unknown): InboundMessage[] {
    const messages: InboundMessage[] = [];
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries as Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { text?: string; is_echo?: boolean };
      }>;
    }>) {
      for (const m of entry.messaging ?? []) {
        if (!m.message?.text || m.message.is_echo) continue;
        messages.push({
          platform: "instagram",
          accountExternalId: m.recipient?.id ?? entry.id ?? "",
          customerHandle: m.sender?.id ?? "",
          body: m.message.text,
          receivedAt: new Date().toISOString(),
        });
      }
    }
    return messages;
  },
  async send(accountExternalId, customerHandle, body) {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error("Instagram delivery is not configured: META_ACCESS_TOKEN is missing.");
    const res = await fetch(`https://graph.facebook.com/v20.0/${accountExternalId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: customerHandle }, message: { text: body } }),
    });
    if (!res.ok) throw new Error(`Instagram send failed: ${res.status} ${await res.text()}`);
  },
};

export const emailAdapter: PlatformAdapter = {
  platform: "email",
  parseWebhook(payload: unknown): InboundMessage[] {
    const p = (payload ?? {}) as {
      from?: string; From?: string; sender?: string;
      fromName?: string; FromName?: string;
      subject?: string; Subject?: string;
      text?: string; TextBody?: string; "body-plain"?: string;
      to?: string; To?: string; mailbox?: string;
    };
    const from = p.from ?? p.From ?? p.sender;
    const body = p.text ?? p.TextBody ?? p["body-plain"];
    if (!from || !body) return [];
    const subject = p.subject ?? p.Subject;
    return [{
      platform: "email",
      accountExternalId: p.to ?? p.To ?? p.mailbox ?? "support-inbox",
      customerHandle: from,
      customerName: p.fromName ?? p.FromName,
      body: subject ? `${subject}\n\n${body}` : body,
      receivedAt: new Date().toISOString(),
    }];
  },
  async send(accountExternalId, customerHandle, body) {
    void accountExternalId;
    const sent = await sendEmail({ to: customerHandle, subject: "Re: your message", text: body });
    if (!sent) throw new Error("Email delivery is not configured; the message was not sent.");
  },
};

const ADAPTERS: Partial<Record<SocialPlatform, PlatformAdapter>> = {
  sandbox: sandboxAdapter,
  instagram: instagramAdapter,
  email: emailAdapter,
};

export function getAdapter(platform: SocialPlatform): PlatformAdapter {
  const a = ADAPTERS[platform];
  if (!a) throw new Error(`Unsupported platform: ${platform}. Outbound delivery is disabled until an adapter is configured.`);
  return a;
}

export function isPlatformSupported(platform: SocialPlatform): boolean {
  return Boolean(ADAPTERS[platform]);
}
