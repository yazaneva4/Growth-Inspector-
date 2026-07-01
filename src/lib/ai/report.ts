import { anthropic, MODELS } from "./anthropic";
import type { AnalyticsSummary } from "@/lib/analytics";

export interface GrowthReport {
  headline: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One punchy sentence summarising the week.",
    },
    highlights: {
      type: "array",
      items: { type: "string" },
      description: "2-4 positive findings, each with a number.",
    },
    concerns: {
      type: "array",
      items: { type: "string" },
      description: "1-3 things to watch (complaints, negative sentiment, drop-offs).",
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "2-4 concrete, Saudi-market-aware actions to grow next week.",
    },
  },
  required: ["headline", "highlights", "concerns", "recommendations"],
  additionalProperties: false,
} as const;

/**
 * The "Growth Inspector" weekly analyst. Turns aggregated stats into a
 * narrative report using Opus (deeper reasoning per SPEC §8).
 */
export async function generateGrowthReport(
  summary: AnalyticsSummary,
): Promise<GrowthReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackReport(summary);
  }

  const system = [
    "You are the Growth Inspector — an expert social-media growth analyst for",
    "Saudi businesses. You read a week of customer-conversation metrics and",
    "produce a sharp, actionable report. Be specific and cite the numbers.",
    "Be aware of the Saudi context: prayer times, weekends (Fri/Sat), Arabic",
    "dialect engagement, and local buying behaviour. Keep it concise and",
    "business-focused. Recommendations must be concrete actions.",
  ].join("\n");

  const user = `Here is this week's data for ${summary.orgName} (last ${summary.rangeDays} days):

Totals: ${summary.totals.conversations} conversations, ${summary.totals.aiReplies} AI replies, ${summary.totals.escalations} escalations, ${(summary.totals.autoResolutionRate * 100).toFixed(0)}% auto-resolved, ${summary.totals.hotLeads} hot leads.
Intents: ${summary.intents.map((i) => `${i.intent}=${i.count}`).join(", ")}.
Sentiment: positive=${summary.sentiment.positive}, neutral=${summary.sentiment.neutral}, negative=${summary.sentiment.negative}.
Languages: ${summary.languages.map((l) => `${l.language}=${l.count}`).join(", ")}.
Volume by day: ${summary.volumeByDay.map((v) => `${v.day}=${v.count}`).join(", ")}.

Write the weekly growth report.`;

  try {
    const res = await anthropic().messages.create({
      model: MODELS.analysis,
      max_tokens: 1500,
      system,
      tools: [
        {
          name: "write_report",
          description: "Return the weekly growth report",
          input_schema: REPORT_SCHEMA as never,
        },
      ],
      tool_choice: { type: "tool", name: "write_report" },
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") return block.input as GrowthReport;
  } catch (err) {
    console.error("report generation failed", err);
  }
  return fallbackReport(summary);
}

/** Deterministic report when no AI key is configured. */
function fallbackReport(summary: AnalyticsSummary): GrowthReport {
  const t = summary.totals;
  return {
    headline: `${t.conversations} conversations handled, ${(t.autoResolutionRate * 100).toFixed(0)}% auto-resolved.`,
    highlights: [
      `${t.aiReplies} replies sent autonomously by Growth Inspector.`,
      `${t.hotLeads} hot leads identified for follow-up.`,
    ],
    concerns:
      summary.sentiment.negative > 0
        ? [`${summary.sentiment.negative} conversations had negative sentiment — review escalations.`]
        : ["No major concerns this week."],
    recommendations: [
      "Connect an ANTHROPIC_API_KEY to unlock the full AI-written analyst report.",
      "Follow up on the top hot leads while intent is high.",
    ],
  };
}
