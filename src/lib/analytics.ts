import { createPublicClient } from "@/lib/supabase/server";

export interface AnalyticsSummary {
  orgName: string;
  rangeDays: number;
  totals: {
    conversations: number;
    messages: number;
    aiReplies: number;
    escalations: number;
    autoResolutionRate: number; // 0-1
    hotLeads: number;
  };
  intents: { intent: string; count: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  languages: { language: string; count: number }[];
  volumeByDay: { day: string; count: number }[];
  topLeads: {
    customer: string;
    handle: string;
    lead_score: number;
    intent: string | null;
  }[];
}

const DEMO_SLUG = "demo";

/**
 * Aggregate a window of activity for an org into the numbers that power the
 * Growth Inspector dashboards. Reads via RLS (public demo workspace by
 * default; pass another slug for an authenticated org).
 */
export async function getAnalytics(
  rangeDays = 7,
  orgSlug = DEMO_SLUG,
): Promise<AnalyticsSummary | null> {
  const db = createPublicClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return null;

  const since = new Date(
    Date.now() - rangeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [{ data: convs }, { data: msgs }, { count: escCount }] =
    await Promise.all([
      db
        .from("conversations")
        .select("intent, sentiment, language, lead_score, status, customer_name, customer_handle, created_at")
        .eq("org_id", org.id)
        .gte("created_at", since),
      db
        .from("messages")
        .select("author, created_at")
        .eq("org_id", org.id)
        .gte("created_at", since),
      db
        .from("escalations")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .gte("created_at", since),
    ]);

  const conversations = convs ?? [];
  const messages = msgs ?? [];
  const escalations = escCount ?? 0;
  const aiReplies = messages.filter((m) => m.author === "ai").length;

  // Intent breakdown.
  const intentMap = new Map<string, number>();
  for (const c of conversations)
    intentMap.set(c.intent ?? "other", (intentMap.get(c.intent ?? "other") ?? 0) + 1);
  const intents = [...intentMap.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);

  // Sentiment.
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const c of conversations) {
    if (c.sentiment && c.sentiment in sentiment)
      sentiment[c.sentiment as keyof typeof sentiment]++;
  }

  // Languages.
  const langMap = new Map<string, number>();
  for (const c of conversations)
    langMap.set(c.language ?? "unknown", (langMap.get(c.language ?? "unknown") ?? 0) + 1);
  const languages = [...langMap.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  // Volume by day.
  const dayMap = new Map<string, number>();
  for (const c of conversations) {
    const day = c.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const volumeByDay = [...dayMap.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const hotLeads = conversations.filter(
    (c) => c.intent === "hot_lead" || (c.lead_score ?? 0) >= 80,
  ).length;

  const resolved = conversations.filter((c) => c.status !== "escalated").length;
  const autoResolutionRate = conversations.length
    ? resolved / conversations.length
    : 0;

  const topLeads = [...conversations]
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 5)
    .map((c) => ({
      customer: c.customer_name ?? c.customer_handle,
      handle: c.customer_handle,
      lead_score: c.lead_score ?? 0,
      intent: c.intent,
    }));

  return {
    orgName: org.name,
    rangeDays,
    totals: {
      conversations: conversations.length,
      messages: messages.length,
      aiReplies,
      escalations,
      autoResolutionRate,
      hotLeads,
    },
    intents,
    sentiment,
    languages,
    volumeByDay,
    topLeads,
  };
}
