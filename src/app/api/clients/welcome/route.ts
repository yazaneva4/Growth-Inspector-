import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { composeText, ComposeUnavailableError } from "@/lib/ai/compose";

/**
 * Generates a warm, detailed "thank you for joining our CRM" message for a
 * client, using the agentic open-source AI chain (Claude → OpenRouter →
 * Gemini). Returned as plain text the client component pre-fills into a
 * WhatsApp deep link. No message is sent server-side.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const company = (body?.company as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  const workspaceName = org?.name ?? "Growth Space";

  const firstName = name.split(/\s+/)[0];

  const system = [
    `You write short, warm, professional welcome messages on behalf of "${workspaceName}",`,
    "a customer-engagement business serving the Saudi market.",
    "The message thanks a new client for joining the CRM / signing up.",
    "Tone: friendly, appreciative, human — light Khaleeji warmth is welcome but keep it professional.",
    "Write it ready to send over WhatsApp: greet them by first name, thank them warmly for joining,",
    "briefly say what they can expect (fast, human-like support in Arabic and English, around the clock),",
    "and invite them to reply any time. Keep it detailed but under ~90 words.",
    "Use one or two tasteful emoji at most. Do NOT use markdown, headings, or placeholders like [name] —",
    "write the final message with the real name filled in. Output only the message text, nothing else.",
  ].join(" ");

  const user = company
    ? `Write the welcome message for ${firstName} from ${company}.`
    : `Write the welcome message for ${firstName}.`;

  try {
    const message = await composeText({ system, user });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ComposeUnavailableError) {
      // Graceful fallback so the button always works, even with no AI keys.
      const fallback = `Hi ${firstName}, thank you so much for joining ${workspaceName}! 🙌 We're thrilled to have you. You can reach us any time in Arabic or English — we're here around the clock to help. Welcome aboard!`;
      return NextResponse.json({ message: fallback, fallback: true });
    }
    console.error("Welcome message generation failed:", err);
    return NextResponse.json({ error: "failed to generate message" }, { status: 500 });
  }
}
