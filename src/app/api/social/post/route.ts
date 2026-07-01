import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftSocialPost } from "@/lib/ai/social-post";
import { postTweet, X_CONFIGURED } from "@/lib/platforms/x";
import type { BrandVoice } from "@/lib/types";

const PLATFORMS = ["x"] as const; // Instagram feed posts require media and
// aren't wired here yet — see DEPLOY.md.

/**
 * Lets the agent actively use social media, not just reply to inbound
 * messages: publish a post, either exactly as given or AI-drafted from a
 * topic (e.g. something surfaced by the trend radar) in the workspace's
 * brand voice.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const platform = PLATFORMS.includes(body?.platform) ? body.platform : null;
  const topic = (body?.topic as string | undefined)?.trim();
  const text = (body?.text as string | undefined)?.trim();
  const replyToTweetId = body?.replyToId as string | undefined;

  if (!platform) {
    return NextResponse.json(
      { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!topic && !text) {
    return NextResponse.json(
      { error: "provide either 'text' (post exactly this) or 'topic' (AI drafts it)" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "no organization" }, { status: 404 });
  }

  let finalText = text;
  if (!finalText) {
    const { data: org } = await supabase
      .from("organizations")
      .select("brand_voice")
      .eq("id", membership.org_id)
      .single();
    finalText = await draftSocialPost({
      topic: topic!,
      voice: (org?.brand_voice ?? {}) as BrandVoice,
      platform,
    });
  }

  if (platform === "x") {
    if (!X_CONFIGURED) {
      return NextResponse.json({ ok: true, dryRun: true, text: finalText });
    }
    try {
      const posted = await postTweet(finalText, replyToTweetId);
      return NextResponse.json({ ok: true, text: finalText, ...posted });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "post failed" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: "unsupported platform" }, { status: 400 });
}
