import { anthropic, MODELS } from "./anthropic";
import type { AnalyticsSummary } from "@/lib/analytics";

export interface TrendRadar {
  headline: string;
  themes: { topic: string; why: string; action: string }[];
  hashtags: string[];
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One line on what's trending this week." },
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string", description: "A rising topic/theme." },
          why: { type: "string", description: "The signal behind it (cite the data)." },
          action: { type: "string", description: "A concrete content/marketing move." },
        },
        required: ["topic", "why", "action"],
        additionalProperties: false,
      },
    },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "Relevant Saudi-market hashtags (Arabic and/or English).",
    },
  },
  required: ["headline", "themes", "hashtags"],
  additionalProperties: false,
} as const;

/**
 * Trend radar (SPEC §4.2). Reads the workspace's conversation signals and,
 * using Opus, surfaces rising themes + Saudi-aware content moves. Falls back to
 * a deterministic read of the data when no AI key is configured.
 */
export async function generateTrendRadar(
  summary: AnalyticsSummary,
): Promise<TrendRadar> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(summary);

  const system = [
    "You are the Growth Inspector trend radar for a Saudi business. From the",
    "conversation signals, infer what topics are rising with customers and",
    "suggest concrete, culturally-aware content/marketing moves (prayer times,",
    "Fri/Sat weekend, Arabic dialect, local seasons/occasions). Be specific and",
    "cite the numbers. Keep it tight.",
  ].join("\n");

  const user = `Signals for ${summary.orgName} (last ${summary.rangeDays} days):
Intents: ${summary.intents.map((i) => `${i.intent}=${i.count}`).join(", ")}.
Sentiment: +${summary.sentiment.positive} / =${summary.sentiment.neutral} / -${summary.sentiment.negative}.
Languages: ${summary.languages.map((l) => `${l.language}=${l.count}`).join(", ")}.
Volume by day: ${summary.volumeByDay.map((v) => `${v.day}=${v.count}`).join(", ")}.
Hot leads: ${summary.totals.hotLeads}. Total conversations: ${summary.totals.conversations}.

Produce the trend radar.`;

  try {
    const res = await anthropic().messages.create({
      model: MODELS.analysis,
      max_tokens: 1200,
      system,
      tools: [{ name: "trend_radar", description: "Return the trend radar", input_schema: SCHEMA as never }],
      tool_choice: { type: "tool", name: "trend_radar" },
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") return block.input as TrendRadar;
  } catch (err) {
    console.error("trend radar failed", err);
  }
  return fallback(summary);
}

function fallback(summary: AnalyticsSummary): TrendRadar {
  const top = summary.intents[0]?.intent ?? "inquiries";
  return {
    headline: `${top.replace(/_/g, " ")} is your most common conversation this week.`,
    themes: summary.intents.slice(0, 3).map((i) => ({
      topic: i.intent.replace(/_/g, " "),
      why: `${i.count} conversation${i.count === 1 ? "" : "s"} centered on this.`,
      action:
        i.intent === "price_inquiry"
          ? "Post a clear pricing/offer story to cut repeat questions."
          : i.intent === "complaint"
            ? "Address the recurring issue publicly and follow up fast."
            : "Create content that leans into this demand.",
    })),
    hashtags: ["#SaudiArabia", "#growth", "#marketing", "#oud", "#KSA"],
  };
}
