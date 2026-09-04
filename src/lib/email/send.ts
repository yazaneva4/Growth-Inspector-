/**
 * Unified outbound email for the whole app (invoices, access requests, inbox
 * email replies). Transport priority:
 *   1. Gmail SMTP — set GMAIL_USER + GMAIL_APP_PASSWORD.
 *   2. Dry-run — nothing configured: logs the attempted send and returns false.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export function emailTransport(): "gmail" | "none" {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return "none";
}

/** Resolves true only when the SMTP provider accepted the message. */
export async function sendEmail(mail: OutboundEmail): Promise<boolean> {
  const transport = emailTransport();

  if (transport === "gmail") {
    const user = process.env.GMAIL_USER!;
    const nodemailer = (await import("nodemailer")).default;
    const smtp = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: process.env.GMAIL_APP_PASSWORD! },
    });
    await smtp.sendMail({
      from: process.env.EMAIL_FROM ?? `Growth Inspector <${user}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return true;
  }

  console.log(`[email:dryrun] "${mail.subject}" -> ${mail.to}`);
  return false;
}
