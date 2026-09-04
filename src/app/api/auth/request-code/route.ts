import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import crypto from "node:crypto";

export const runtime = "nodejs";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashCode(email: string, code: string) {
  const secret = process.env.AUTH_EMAIL_HOOK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Authentication email secret is not configured.");
  return crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

function siteUrl(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const mode = body?.mode === "signup" ? "signup" : "signin";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!validEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date();
    const cutoff = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    const { data: recent } = await supabase
      .from("auth_email_codes")
      .select("id, created_at")
      .eq("email", email)
      .gte("created_at", cutoff)
      .is("consumed_at", null)
      .limit(1)
      .maybeSingle();

    if (recent) {
      return NextResponse.json({ error: "A code was already sent. Please wait before requesting another." }, { status: 429 });
    }

    let userId: string | undefined;

    if (mode === "signup") {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          return NextResponse.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
        }
        throw error;
      }
      userId = data.user?.id;
    } else {
      // Resolve the user server-side so a previously unconfirmed account can
      // be confirmed after the Growth Inspector code is entered.
      let page = 1;
      while (!userId && page <= 10) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const match = data.users.find((u) => u.email?.toLowerCase() === email);
        userId = match?.id;
        if (data.users.length < 1000) break;
        page += 1;
      }
      if (!userId) {
        return NextResponse.json({ error: "No account was found for this email. Create an account first." }, { status: 404 });
      }
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = hashCode(email, code);
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("auth_email_codes").insert({
      email,
      user_id: userId,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const loginLink = `${siteUrl(req)}/login?email=${encodeURIComponent(email)}`;
    const action = mode === "signup" ? "finish creating your Growth Inspector account" : "sign in to Growth Inspector";
    const text = `Growth Inspector\n\nUse this 6-digit code to ${action}: ${code}\n\nThe code expires in ${CODE_TTL_MINUTES} minutes.\n\nOpen Growth Inspector: ${loginLink}\n\nIf you did not request this, you can ignore this email.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Growth Inspector</h2><p>Use this 6-digit code to ${action}:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center">${code}</p><p>This code expires in ${CODE_TTL_MINUTES} minutes.</p><p><a href="${loginLink}" style="display:inline-block;padding:12px 18px;background:#10b981;color:white;text-decoration:none;border-radius:8px">Open Growth Inspector</a></p><p style="font-size:12px;color:#64748b">If you did not request this, you can ignore this email.</p></div>`;

    await sendEmail({
      to: email,
      subject: mode === "signup" ? "Your Growth Inspector verification code" : "Your Growth Inspector sign-in code",
      text,
      html,
    });

    return NextResponse.json({ ok: true, expiresInSeconds: CODE_TTL_MINUTES * 60 });
  } catch (error) {
    console.error("Growth Inspector auth email:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send the authentication email." }, { status: 500 });
  }
}
