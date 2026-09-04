import { createPublicClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AnalyticsSummary {
  orgName: string;
  rangeDays: number;
  totals: { conversations: number; messages: number; aiReplies: number; escalations: number; autoResolutionRate: number; hotLeads: number };
  intents: { intent: string; count: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  languages: { language: string; count: number }[];
  volumeByDay: { day: string; count: number }[];
  topLeads: { customer: string; handle: string; lead_score: number; intent: string | null }[];
  recent: { customer: string; handle: string; platform: string; intent: string | null; lead_score: number; last_message_at: string }[];
  escalationsList: { reason: string; customer: string; language: string | null; draft: string | null }[];
}

const DEMO_SLUG = "demo";

export async function getAnalytics(rangeDays = 7, orgSlug = DEMO_SLUG, client?: SupabaseClient): Promise<AnalyticsSummary | null> {
  const db = client ?? createPublicClient();
  let org: { id: string; name: string } | null = null;
  try {
    const { data } = await db.from("organizations").select("id, name").eq("slug", orgSlug).maybeSingle();
    org = data;
  } catch { return null; }
  if (!org) return null;

  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  let convsRes, msgsRes, escRes;
  try {
    [convsRes, msgsRes, escRes] = await Promise.all([
      db.from("conversations").select("intent, sentiment, language, lead_score, status, customer_name, customer_handle, platform, last_message_at, created_at").eq("org_id", org.id).gte("created_at", since),
      db.from("messages").select("author, created_at").eq("org_id", org.id).gte("created_at", since),
      db.from("escalations").select("*", { count: "exact", head: true }).eq("org_id", org.id).gte("created_at", since),
    ]);
  } catch { return null; }

  const conversations = convsRes.data ?? [];
  const messages = msgsRes.data ?? [];
  const escalations = escRes.count ?? 0;
  const aiReplies = messages.filter((m) => m.author === "ai").length;

  const intentMap = new Map<string, number>();
  for (const c of conversations) intentMap.set(c.intent ?? "other", (intentMap.get(c.intent ?? "other") ?? 0) + 1);
  const intents = [...intentMap.entries()].map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const c of conversations) if (c.sentiment && c.sentiment in sentiment) sentiment[c.sentiment as keyof typeof sentiment]++;

  const langMap = new Map<string, number>();
  for (const c of conversations) langMap.set(c.language ?? "unknown", (langMap.get(c.language ?? "unknown") ?? 0) + 1);
  const languages = [...langMap.entries()].map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count);

  const dayMap = new Map<string, number>();
  for (const c of conversations) {
    const day = c.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const volumeByDay = [...dayMap.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));

  const hotLeads = conversations.filter((c) => c.intent === "hot_lead" || (c.lead_score ?? 0) >= 80).length;
  const resolved = conversations.filter((c) => c.status !== "escalated").length;
  const autoResolutionRate = conversations.length ? resolved / conversations.length : 0;

  const topLeads = [...conversations].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 5).map((c) => ({
    customer: c.customer_name ?? c.customer_handle, handle: c.customer_handle, lead_score: c.lead_score ?? 0, intent: c.intent,
  }));
  const recent = [...conversations].sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)).slice(0, 5).map((c) => ({
    customer: c.customer_name ?? c.customer_handle, handle: c.customer_handle, platform: c.platform ?? "sandbox", intent: c.intent,
    lead_score: c.lead_score ?? 0, last_message_at: c.last_message_at ?? c.created_at,
  }));

  let escalationsList: AnalyticsSummary["escalationsList"] = [];
  try {
    const { data: escRows } = await db.from("escalations")
      .select("reason, draft, conversations(customer_name, customer_handle, language)")
      .eq("org_id", org.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(4);
    escalationsList = (escRows ?? []).map((e) => {
      const c = (e.conversations ?? {}) as { customer_name?: string; customer_handle?: string; language?: string };
      return { reason: e.reason as string, customer: c.customer_name ?? c.customer_handle ?? "Customer", language: c.language ?? null, draft: (e.draft as string | null) ?? null };
    });
  } catch { escalationsList = []; }

  return { orgName: org.name, rangeDays, totals: { conversations: conversations.length, messages: messages.length, aiReplies, escalations, autoResolutionRate, hotLeads }, intents, sentiment, languages, volumeByDay, topLeads, recent, escalationsList };
}
