/**
 * Growth Inspector application email transport.
 *
 * Customer mailboxes are provider-agnostic: the recipient can be on Gmail,
 * Outlook, Yahoo, iCloud, or another normal email service. Growth Inspector
 * never needs that customer's provider API or credentials.
 *
 * Resend is the single application email transport. Supabase/Auth may send
 * authentication mail through its own configured provider; application mail
 * (invoices, access approvals, inbox replies, Growth AI email actions) comes
 * through this module.
 *
 * Required environment variables:
 *   RESEND_API_KEY — server-side Resend API key.
 *   EMAIL_FROM — verified Resend sender, for example
 *     Growth Inspector <support@growth-inspector.spiritofrushna.com>.
 *
 * The recipient domain is never used to select a transport. One Resend sender
 * can deliver to normal Gmail, Outlook, Yahoo, iCloud, and other mailboxes.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
  references?: string | string[];
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function emailTransport(): "resend" | "none" {
  return env("RESEND_API_KEY") && env("EMAIL_FROM") ? "resend" : "none";
}

let resendPromise: Promise<import("resend").Resend> | undefined;

async function getResend() {
  if (!env("RESEND_API_KEY")) return null;
  resendPromise ??= (async () => {
    const { Resend } = await import("resend");
    return new Resend(env("RESEND_API_KEY")!);
  })();
  return resendPromise;
}

/**
 * Resolves true only when Resend accepted the message.
 * The recipient domain is intentionally never used to select a transport.
 */
export async function sendEmail(mail: OutboundEmail): Promise<boolean> {
  const to = mail.to.trim();
  const subject = mail.subject.trim();
  const from = env("EMAIL_FROM");

  if (!to || !subject || (!mail.text && !mail.html)) {
    throw new Error("Application email requires a recipient, subject, and body.");
  }

  if (!env("RESEND_API_KEY")) {
    throw new Error(
      "Growth Inspector application email is not configured. Add RESEND_API_KEY to the server environment.",
    );
  }

  if (!from) {
    throw new Error("EMAIL_FROM is required and must use a verified Resend sender domain.");
  }

  const resend = await getResend();
  if (!resend) throw new Error("Resend email transport is unavailable.");

  const headers: Record<string, string> = {};
  if (mail.inReplyTo) headers["In-Reply-To"] = mail.inReplyTo;
  if (mail.references) {
    headers.References = Array.isArray(mail.references)
      ? mail.references.join(" ")
      : mail.references;
  }

  const payload: import("resend").CreateEmailOptions = {
    from,
    to: [to],
    subject,
    ...(mail.html ? { html: mail.html } : {}),
    ...(mail.text ? { text: mail.text } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
  };

  const { error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(`Resend rejected the email: ${error.message}`);
  }

  return true;
}
