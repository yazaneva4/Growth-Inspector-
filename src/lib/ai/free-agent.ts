import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";
import { opencodeChatText, OPENCODE_MODEL } from "./opencode";
import { openrouterChatText, OPENROUTER_MODEL_A } from "./openrouter";

export type FreeAgentHistoryMessage = { role: "user" | "assistant"; content: string };
export type FreeAgentStep = { tool: string; args: Record<string, unknown>; result: unknown };

const systemPrompt = (orgName: string) => `You are Growth AI for "${orgName}". Have a natural multi-turn conversation, use workspace tool results when provided, cite real numbers, and only take actions when explicitly requested. You are restricted to free AI inference only. Do not claim that you sent an email, changed data, or performed an action unless the application actually did it.`;

async function runTool(name: string, args: Record<string, unknown>, ctx: { db: SupabaseClient; orgId: string; orgSlug: string }) {
  switch (name) {
    case "get_analytics_summary":
      return (await getAnalytics(typeof args.days === "number" ? Math.min(90, Math.max(1, args.days)) : 7, ctx.orgSlug, ctx.db)) ?? { error: "no data" };
    case "get_competitors": {
      const { data, error } = await ctx.db.from("competitors").select("handle, platform, notes").eq("org_id", ctx.orgId).order("created_at", { ascending: true });
      return error ? { error: error.message } : (data ?? []);
    }
    case "get_trend_radar": {
      const a = await getAnalytics(7, ctx.orgSlug, ctx.db);
      return a ? generateTrendRadar(a) : { error: "no data" };
    }
    default: return null;
  }
}

function requestedTools(goal: string) {
  const s = goal.toLowerCase();
  const tools: Array<{ name: string; args: Record<string, unknown> }> = [];
  if (/analytics|metrics|statistics|stats|performance|conversion|funnel|growth numbers/.test(s)) tools.push({ name: "get_analytics_summary", args: { days: 7 } });
  if (/competitor|competitors|rival/.test(s)) tools.push({ name: "get_competitors", args: {} });
  if (/trend|trends|radar|what.*changing/.test(s)) tools.push({ name: "get_trend_radar", args: {} });
  return tools;
}

async function answerWith(provider: "opencode" | "openrouter", goal: string, history: FreeAgentHistoryMessage[], orgName: string, toolContext: string) {
  const prompt = `${systemPrompt(orgName)}\n${toolContext ? `Workspace tool results:\n${toolContext}\n\n` : ""}${history.slice(-32).map((m) => `${m.role === "user" ? "User" : "Growth AI"}: ${m.content}`).join("\n")}\nUser: ${goal}`;
  if (provider === "opencode") return opencodeChatText({ system: systemPrompt(orgName), user: prompt });
  return openrouterChatText({ model: OPENROUTER_MODEL_A, system: systemPrompt(orgName), user: prompt });
}

export async function runFreeGrowthAgent(opts: {
  goal: string;
  history: FreeAgentHistoryMessage[];
  orgName: string;
  orgId: string;
  orgSlug: string;
  db: SupabaseClient;
}) {
  const steps: FreeAgentStep[] = [];
  for (const requested of requestedTools(opts.goal)) {
    const result = await runTool(requested.name, requested.args, { db: opts.db, orgId: opts.orgId, orgSlug: opts.orgSlug });
    if (result !== null) steps.push({ ...requested, result });
  }
  const toolContext = steps.length ? JSON.stringify(steps) : "";
  let lastError: unknown;
  try {
    return { answer: await answerWith("opencode", opts.goal, opts.history, opts.orgName, toolContext), provider: "opencode", model: OPENCODE_MODEL, steps, auto: true, fallbackCount: 0 };
  } catch (error) {
    lastError = error;
  }
  try {
    return { answer: await answerWith("openrouter", opts.goal, opts.history, opts.orgName, toolContext), provider: "openrouter", model: OPENROUTER_MODEL_A, steps, auto: true, fallbackCount: 1 };
  } catch (error) {
    lastError = error;
  }
  throw lastError instanceof Error ? lastError : new Error("No free AI provider is available.");
}
