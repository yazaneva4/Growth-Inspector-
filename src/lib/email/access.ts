import { SITE_NAME } from "@/lib/site";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const shell = (inner: string) => `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#1B2A6B;color:#ffffff;padding:22px 28px;font-size:18px;font-weight:bold;">
      ${esc(SITE_NAME)}
    </div>
    <div style="padding:26px 28px;font-size:14px;line-height:1.6;">${inner}</div>
    <div style="background:#f8fafc;padding:14px 28px;font-size:12px;color:#64748b;text-align:center;">
      ${esc(SITE_NAME)} · Saudi Arabia
    </div>
  </div>
</body></html>`;

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Growth Inspector <onboarding@resend.dev>";
  if (!apiKey) {
    console.log(`[access:dryrun] ${subject} -> ${to}`);
    return false;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Access email failed: ${error.message}`);
  return true;
}

/** Notify the workspace owner that someone requested access. */
export function sendAccessRequestedEmail(opts: {
  ownerEmail: string;
  requesterName: string;
  requesterEmail: string;
  reviewUrl: string;
}): Promise<boolean> {
  const html = shell(`
    <p><strong>${esc(opts.requesterName)}</strong> (${esc(opts.requesterEmail)})
    has requested access to your ${esc(SITE_NAME)} workspace.</p>
    <p style="margin-top:18px;">
      <a href="${esc(opts.reviewUrl)}"
         style="display:inline-block;background:#F26522;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:bold;">
        Review request
      </a>
    </p>
    <p style="color:#64748b;margin-top:18px;">Sign in and approve to give them their own login.</p>
  `);
  return send(opts.ownerEmail, `Access request from ${opts.requesterName}`, html);
}

/** Tell an approved requester how to set their password and sign in. */
export function sendAccessApprovedEmail(opts: {
  email: string;
  name: string;
  setPasswordUrl: string;
}): Promise<boolean> {
  const html = shell(`
    <p>Hi ${esc(opts.name)},</p>
    <p>Your access to ${esc(SITE_NAME)} was approved. Set your password to sign in:</p>
    <p style="margin-top:18px;">
      <a href="${esc(opts.setPasswordUrl)}"
         style="display:inline-block;background:#F26522;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:bold;">
        Set your password
      </a>
    </p>
    <p style="color:#64748b;margin-top:18px;">This link is personal to you — don't share it.</p>
  `);
  return send(opts.email, `You're approved for ${SITE_NAME}`, html);
}
