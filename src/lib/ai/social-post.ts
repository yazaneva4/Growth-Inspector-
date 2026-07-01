import { anthropic, MODELS } from "./anthropic";
import type { BrandVoice } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: "The finished, ready-to-publish post text.",
    },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

/**
 * Lets the agent actively publish content, not just react to inbound
 * messages: given a topic (e.g. from the trend radar) and the workspace's
 * brand voice, drafts a ready-to-post caption/tweet.
 */
export async function draftSocialPost(opts: {
  topic: string;
  voice: BrandVoice;
  platform: "x" | "instagram";
  language?: "ar" | "en" | "mixed";
}): Promise<string> {
  const limits =
    opts.platform === "x"
      ? "Hard limit: 280 characters. Punchy, no hashtag stuffing (0-3 max)."
      : "Instagram caption: 1-3 short paragraphs, 3-8 relevant hashtags at the end.";

  const voiceParts: string[] = [];
  if (opts.voice.tone) voiceParts.push(`Tone: ${opts.voice.tone}`);
  if (opts.voice.facts) voiceParts.push(`Business facts: ${opts.voice.facts}`);
  if (opts.voice.guardrails?.length)
    voiceParts.push(`Never: ${opts.voice.guardrails.join("; ")}`);

  const system = [
    "You are the Growth Inspector, writing a public social media post for a",
    "Saudi business. Never touch politics, religion, or gender-sensitive topics.",
    "Be authentic and culturally aware (Saudi weekend Fri/Sat, prayer times,",
    "local occasions). Write in " +
      (opts.language === "en"
        ? "English."
        : opts.language === "mixed"
          ? "natural Arabic/English code-switching, as a Saudi brand would."
          : "natural Saudi Arabic (Khaleeji-friendly MSA)."),
    limits,
    "",
    voiceParts.length ? "BRAND VOICE:\n" + voiceParts.join("\n") : "",
  ].join("\n");

  const res = await anthropic().messages.create({
    model: MODELS.reply,
    max_tokens: 500,
    system,
    tools: [
      { name: "write_post", description: "Return the finished post", input_schema: SCHEMA as never },
    ],
    tool_choice: { type: "tool", name: "write_post" },
    messages: [{ role: "user", content: `Topic: ${opts.topic}\n\nWrite the post.` }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return a post");
  }
  return (block.input as { text: string }).text;
}
