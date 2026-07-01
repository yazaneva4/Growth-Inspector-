import { NextResponse } from "next/server";

/**
 * Integration health check. Reports which API keys are configured WITHOUT
 * exposing any values — just booleans. Hit this after adding env vars in Vercel
 * to confirm each integration is live.
 */
export async function GET() {
  const has = (v?: string) => Boolean(v && v.length > 0);
  return NextResponse.json({
    ok: true,
    integrations: {
      supabase: has(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "configured" : "fallback",
      supabase_service_role: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
      anthropic: has(process.env.ANTHROPIC_API_KEY), // AI responder + weekly report
      resend_email: has(process.env.RESEND_API_KEY), // email replies
      meta_verify_token: has(process.env.META_VERIFY_TOKEN), // WhatsApp/IG webhooks
      twilio_auth_token: has(process.env.TWILIO_AUTH_TOKEN), // voice webhook signature verification
    },
    note: "Booleans only — no secret values are exposed. Google sign-in is enabled in the Supabase dashboard, not via env vars.",
  });
}
