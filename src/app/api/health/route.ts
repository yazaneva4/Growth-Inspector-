import { NextResponse } from "next/server";
import { X_CONFIGURED } from "@/lib/platforms/x";
import { emailTransport } from "@/lib/email/send";
import { geminiConfigured } from "@/lib/ai/gemini";
import {
  openrouterConfigured,
  OPENROUTER_MODEL_A,
  OPENROUTER_MODEL_B,
} from "@/lib/ai/openrouter";
import { zaiConfigured, ZAI_MODEL } from "@/lib/ai/zai";

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
      supabase_service_role: has(process.env.SUPABASE_SERVICE_ROLE_KEY), // also enables the sign-in self-heal for accounts stuck unconfirmed
      anthropic: has(process.env.ANTHROPIC_API_KEY), // AI responder + weekly report (primary provider)
      zai: zaiConfigured() ? ZAI_MODEL : false, // first responder fallback after Claude (z.ai / GLM)
      gemini: geminiConfigured(), // responder fallback + Growth Agent
      openrouter: openrouterConfigured()
        ? { tier_a: OPENROUTER_MODEL_A, tier_b: OPENROUTER_MODEL_B }
        : false, // responder fallback tiers (after Claude, and after Gemini)
      email_transport: emailTransport(), // "gmail" | "none" — invoices, access emails, inbox replies
      meta_verify_token: has(process.env.META_VERIFY_TOKEN), // WhatsApp/IG webhooks
      meta_access_token: has(process.env.META_ACCESS_TOKEN), // real WhatsApp/Instagram DM sending
      twilio_auth_token: has(process.env.TWILIO_AUTH_TOKEN), // voice webhook signature verification
      twilio_account_sid: has(process.env.TWILIO_ACCOUNT_SID), // needed for Whisper recording download
      whisper_transcription:
        has(process.env.OPENAI_API_KEY) &&
        has(process.env.TWILIO_ACCOUNT_SID) &&
        has(process.env.TWILIO_AUTH_TOKEN), // true = calls use Whisper instead of Twilio's built-in ASR
      voice_chat: has(process.env.OPENAI_API_KEY), // in-dashboard mic-to-AI voice chat (Test the AI)
      elevenlabs_voice: has(process.env.ELEVENLABS_API_KEY), // high-quality spoken replies (else browser voice)
      x_posting: X_CONFIGURED, // agent can publish to X via /api/social/post
    },
    note: "Booleans only — no secret values are exposed.",
  });
}
