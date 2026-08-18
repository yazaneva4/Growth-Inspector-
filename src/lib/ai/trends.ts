import type { AnalyticsSummary } from "@/lib/analytics";

export interface TrendRadar {
  headline: string;
  themes: { topic: string; why: string; action: string }[];
  hashtags: string[];
}

/**
 * Fast, deterministic trend radar.
 *
 * This intentionally does not make a second LLM request. Growth Operator
 * already used the selected provider to decide to call this tool, so invoking
 * another provider here only adds latency and can fail because that provider
 * is out of credits/quota.
 */
export async function generateTrendRadar(summary: AnalyticsSummary): Promise<TrendRadar> {
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
