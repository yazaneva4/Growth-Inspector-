/**
 * Unified outbound email for the whole app (invoices, access requests, inbox
 * email replies). Transport priority:
 *   1. Gmail SMTP  — set GMAIL_USER + GMAIL_APP_PASSWORD (Google account with
 *      2-Step Verification → App passwords). Sends as your real Gmail address.
 *   2. Resend      — set RESEND_API_KEY (+ optional EMAIL_FROM).
 *   3. Dry-run     — nothing configured: logs the send and returns false so
 *      callers can mark the item as draft instead of sent.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export function emailTransport(): "gmail" | "resend" | "none" {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  if (process.env.RESEND_API_KEY) return "resend";
  return "none";
}

/** Sends the email; resolves true when actually delivered to a provider. */
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
      // Gmail rewrites the sender to the authenticated account; use EMAIL_FROM
      // only for the display name part.
      from: process.env.EMAIL_FROM ?? `Growth Inspector <${user}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return true;
  }

  if (transport === "resend") {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const from = process.env.EMAIL_FROM ?? "Growth Inspector <onboarding@resend.dev>";
    const base = { from, to: mail.to, subject: mail.subject };
    const { error } = await resend.emails.send(
      mail.html
        ? { ...base, html: mail.html, text: mail.text }
        : { ...base, text: mail.text ?? "" },
    );
    if (error) throw new Error(`Resend send failed: ${error.message}`);
    return true;
  }

  console.log(`[email:dryrun] "${mail.subject}" -> ${mail.to}`);
  return false;
}
