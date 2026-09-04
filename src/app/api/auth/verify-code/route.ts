import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashCode(email: string, code: string) {
  const secret = process.env.AUTH_EMAIL_HOOK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Authentication email secret is not configured.");
  return crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 6-digit code from Growth Inspector." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: challenge, error: readError } = await supabase
      .from("auth_email_codes")
      .select("id, user_id, code_hash, expires_at, attempts")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readError) throw readError;
    if (!challenge) return NextResponse.json({ error: "That code is invalid or expired. Request a new code." }, { status: 400 });
    if (challenge.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: "Too many code attempts. Request a new code." }, { status: 429 });
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "That code has expired. Request a new code." }, { status: 400 });
    }

    const expected = hashCode(email, code);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(challenge.code_hash, "hex");
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) {
      await supabase
        .from("auth_email_codes")
        .update({ attempts: challenge.attempts + 1 })
        .eq("id", challenge.id);
      return NextResponse.json({ error: "That code is invalid. Check the email and try again." }, { status: 400 });
    }

    if (!challenge.user_id) return NextResponse.json({ error: "Authentication account could not be resolved." }, { status: 500 });

    // The application email code is the email-verification step. Password
    // authentication remains Supabase Auth's job; we never store passwords.
    const { error: confirmError } = await supabase.auth.admin.updateUserById(challenge.user_id, {
      email_confirm: true,
    });
    if (confirmError) throw confirmError;

    const { error: consumeError } = await supabase
      .from("auth_email_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .is("consumed_at", null);
    if (consumeError) throw consumeError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Growth Inspector auth code verification:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not verify the authentication code." }, { status: 500 });
  }
}
