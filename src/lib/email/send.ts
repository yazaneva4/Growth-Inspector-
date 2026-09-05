/**
 * Growth Inspector application email transport.
 *
 * This is deliberately separate from Supabase Auth. Supabase/Auth may send
 * authentication mail through its own configured provider; application mail
 * (invoices, access approvals, inbox replies, Growth AI email actions) comes
 * through this module.
 *
 * Transport priority:
 *   1. Custom SMTP — SMTP_HOST + SMTP_USER + SMTP_PASSWORD.
 *   2. Gmail SMTP — GMAIL_USER + GMAIL_APP_PASSWORD.
 *
 * No credentials means delivery fails explicitly instead of pretending that a
 * message was sent.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
  references?: string | string[];
}

type TransportKind = "smtp" | "gmail" | "none";

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function configuredFrom(user?: string) {
  const configured = env("EMAIL_FROM");
  if (configured && !/yourdomain\.sa/i.test(configured)) return configured;
  return user ? `Growth Inspector <${user}>` : undefined;
}

export function emailTransport(): TransportKind {
  if (env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD")) return "smtp";
  if (env("GMAIL_USER") && env("GMAIL_APP_PASSWORD")) return "gmail";
  return "none";
}

let transporterPromise: Promise<import("nodemailer").Transporter> | undefined;

async function getTransporter() {
  const kind = emailTransport();
  if (kind === "none") return null;
  transporterPromise ??= (async () => {
    const nodemailer = (await import("nodemailer")).default;
    if (kind === "smtp") {
      const port = Number(env("SMTP_PORT") ?? "587");
      return nodemailer.createTransport({
        host: env("SMTP_HOST")!,
        port,
        secure: env("SMTP_SECURE") === "true" || port === 465,
        auth: { user: env("SMTP_USER")!, pass: env("SMTP_PASSWORD")! },
      });
    }
    return nodemailer.createTransport({ service: "gmail", auth: { user: env("GMAIL_USER")!, pass: env("GMAIL_APP_PASSWORD")! } });
  })();
  return transporterPromise;
}

/** Resolves true only when the SMTP provider accepted the message. */
export async function sendEmail(mail: OutboundEmail): Promise<boolean> {
  const to = mail.to.trim();
  const subject = mail.subject.trim();
  if (!to || !subject || (!mail.text && !mail.html)) throw new Error("Application email requires a recipient, subject, and body.");
  const kind = emailTransport();
  if (kind === "none") throw new Error("Growth Inspector application email is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD or GMAIL_USER/GMAIL_APP_PASSWORD in the deployment environment.");
  const transporter = await getTransporter();
  if (!transporter) throw new Error("Application email transport is unavailable.");
  const user = env("SMTP_USER") ?? env("GMAIL_USER");
  const from = configuredFrom(user);
  if (!from) throw new Error("EMAIL_FROM or an SMTP/Gmail sender account is required.");
  await transporter.sendMail({
    from,
    to,
    subject,
    html: mail.html,
    text: mail.text,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
  });
  return true;
}
