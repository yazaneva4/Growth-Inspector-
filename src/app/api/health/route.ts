import { NextResponse } from "next/server";
import { X_CONFIGURED } from "@/lib/platforms/x";
import { emailTransport } from "@/lib/email/send";
import { geminiConfigured } from "@/lib/ai/gemini";
import { openrouterConfigured, OPENROUTER_MODEL_A } from "@/lib/ai/openrouter";
import { zaiConfigured, ZAI_MODEL } from "@/lib/ai/zai";

/** Integration health check. Reports configuration state without exposing secrets. */
export async function GET() {
  const has = (v?: string) => Boolean(v && v.length > 0);
  return NextResponse.json({
    ok: true,
    integrations: {
      supabase: has(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "configured" : "fallback",
      supabase_service_role: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
      anthropic: has(process.env.ANTHROPIC_API_KEY),
      zai: zaiConfigured() ? ZAI_MODEL : false,
      gemini: geminiConfigured(),
      openrouter: openrouterConfigured() ? { model: OPENROUTER_MODEL_A, router: "OpenRouter Free Models Router" } : false,
      email_transport: emailTransport(),
      inbound_email_webhook: has(process.env.INBOX_WEBHOOK_SECRET),
      meta_verify_token: has(process.env.META_VERIFY_TOKEN),
      meta_access_token: has(process.env.META_ACCESS_TOKEN),
      twilio_auth_token: has(process.env.TWILIO_AUTH_TOKEN),
      twilio_account_sid: has(process.env.TWILIO_ACCOUNT_SID),
      whisper_transcription: has(process.env.OPENAI_API_KEY) && has(process.env.TWILIO_ACCOUNT_SID) && has(process.env.TWILIO_AUTH_TOKEN),
      voice_chat: has(process.env.OPENAI_API_KEY),
      elevenlabs_voice: has(process.env.ELEVENLABS_API_KEY),
      x_posting: X_CONFIGURED,
    },
    note: "Booleans and non-secret integration identifiers only — no secret values are exposed.",
  });
}
