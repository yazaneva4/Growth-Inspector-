import type { SupabaseClient } from "@supabase/supabase-js";
import { gemini } from "./gemini";
import { zaiConfigured } from "./zai";
import { openrouterConfigured, OPENROUTER_MODEL_A, OPENROUTER_MODEL_B, openrouterChatText } from "./openrouter";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";

export type AgentProvider = "openai" | "anthropic" | "zai" | "gemini" | "openrouter";
export type AgentSelection = AgentProvider | "auto";
export type AgentModel = { id: string; name: string };
export type AgentProviderState = { configured: boolean; models: AgentModel[] };
export type AgentHistoryMessage = { role: "user" | "assistant"; content: string };
export type AgentStep = { tool: string; args: Record<string, unknown>; result: unknown };
export type AgentRun = { goal: string; provider: AgentProvider; model: string; steps: AgentStep[]; answer: string; auto?: boolean; fallbackCount?: number };

const ZAI_MODELS: AgentModel[] = [
  ["glm-5.1", "GLM-5.1"], ["glm-5", "GLM-5"], ["glm-5-turbo", "GLM-5 Turbo"], ["glm-4.7", "GLM-4.7"],
  ["glm-4.7-flash", "GLM-4.7 Flash"], ["glm-4.7-flashx", "GLM-4.7 FlashX"], ["glm-4.6", "GLM-4.6"],
  ["glm-4.5", "GLM-4.5"], ["glm-4.5-air", "GLM-4.5 Air"], ["glm-4.5-flash", "GLM-4.5 Flash"],
].map(([id, name]) => ({ id, name }));

const OPENROUTER_MODELS: AgentModel[] = [
  { id: OPENROUTER_MODEL_A, name: "Open Router A — GPT-OSS 20B" },
  { id: OPENROUTER_MODEL_B, name: "Open Router B — Gemma 4 31B" },
];

/** Only tools that are actually dispatched by this endpoint are advertised. */
export const TOOL_DECLARATIONS = [
  { name: "get_analytics_summary", description: "Get workspace conversation analytics for a recent window.", parameters: { type: "object", properties: { days: { type: "number" } } } },
  { name: "get_competitors", description: "List tracked competitors and notes.", parameters: { type: "object", properties: {} } },
  { name: "get_trend_radar", description: "Get the workspace trend radar from recent conversation signals.", parameters: { type: "object", properties: {} } },
] as const;

const SYSTEM = (org: string) => `You are Growth AI for "${org}". Have a natural multi-turn conversation, use workspace tool results when provided, cite real numbers, and only take actions when explicitly requested. This endpoint exposes read-only workspace tools; it does not directly send email or WhatsApp messages.`;
const historyText = (history: AgentHistoryMessage[]) => history.slice(-16).map((m) => `${m.role === "user" ? "User" : "Growth AI"}: ${m.content}`).join("\n");

export class ProviderUnavailableError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  constructor(provider: string, message: string, status?: number, retryable = true) {
    super(`${provider}: ${message}`);
    this.name = "ProviderUnavailableError";
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function isProviderTemporarilyUnavailable(error: unknown): boolean {
  if (error instanceof ProviderUnavailableError) return error.retryable;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const statusMatch = lower.match(/\b(408|429|500|501|502|503|504|505|506|507|508|509|510|511)\b/);
  if (statusMatch && isRetryableStatus(Number(statusMatch[1]))) return true;
  return /timeout|timed out|network error|network request failed|fetch failed|connection reset|connection refused|temporarily unavailable|service unavailable|overloaded|too many requests|rate limit|rate_limit|quota|resource exhausted|limit exceeded|insufficient_quota|credit balance|insufficient balance|try again later|model.*not found|unknown model/i.test(lower);
}

async function providerFetch(provider: string, input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(input, { ...init, signal: init.signal ?? controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message = body.slice(0, 1000) || `HTTP ${res.status}`;
      throw new ProviderUnavailableError(provider, message, res.status, isRetryableStatus(res.status) || /model.*not found|unknown model|overloaded|temporarily unavailable/i.test(message));
    }
    return res;
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderUnavailableError(provider, "request timed out", 408, true);
    throw new ProviderUnavailableError(provider, error instanceof Error ? error.message : "network request failed", undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: { db: SupabaseClient; orgId: string; orgSlug: string }) {
  switch (name) {
    case "get_analytics_summary": return (await getAnalytics(typeof args.days === "number" ? Math.min(90, Math.max(1, args.days)) : 7, ctx.orgSlug, ctx.db)) ?? { error: "no data" };
    case "get_competitors": {
      const { data, error } = await ctx.db.from("competitors").select("handle, platform, notes").eq("org_id", ctx.orgId).order("created_at", { ascending: true });
      return error ? { error: error.message } : (data ?? []);
    }
    case "get_trend_radar": {
      const a = await getAnalytics(7, ctx.orgSlug, ctx.db);
      return a ? generateTrendRadar(a) : { error: "no data" };
    }
    default: return { error: `unsupported tool: ${name}` };
  }
}

function fallbackModels(provider: AgentProvider): AgentModel[] {
  if (provider === "openai") return ["gpt-5.6", "gpt-5.5", "gpt-5.4"].map((id) => ({ id, name: id }));
  if (provider === "anthropic") return ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"].map((id) => ({ id, name: id }));
  if (provider === "gemini") return ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-pro", "gemini-2.5-flash"].map((id) => ({ id, name: id }));
  if (provider === "openrouter") return OPENROUTER_MODELS;
  return ZAI_MODELS;
}

let catalogCache: { expires: number; value: Record<AgentProvider, AgentProviderState> } | null = null;
async function buildCatalog(): Promise<Record<AgentProvider, AgentProviderState>> {
  if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
  const value: Record<AgentProvider, AgentProviderState> = {
    openai: { configured: Boolean(process.env.OPENAI_API_KEY), models: fallbackModels("openai") },
    anthropic: { configured: Boolean(process.env.ANTHROPIC_API_KEY), models: fallbackModels("anthropic") },
    zai: { configured: zaiConfigured(), models: ZAI_MODELS },
    gemini: { configured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY), models: fallbackModels("gemini") },
    openrouter: { configured: openrouterConfigured(), models: OPENROUTER_MODELS },
  };
  await Promise.all([
    (async () => { if (!value.openai.configured) return; try { const r = await providerFetch("OpenAI", "https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, cache: "no-store" }); const d = await r.json(); const ids = Array.isArray(d?.data) ? d.data.map((x: { id?: string }) => x.id).filter((x: unknown): x is string => typeof x === "string" && /^gpt-/.test(x)) : []; if (ids.length) value.openai.models = ids.sort().map((id: string) => ({ id, name: id })); } catch {} })(),
    (async () => { if (!value.anthropic.configured) return; try { const r = await providerFetch("Anthropic", "https://api.anthropic.com/v1/models", { headers: { "x-api-key": String(process.env.ANTHROPIC_API_KEY), "anthropic-version": "2023-06-01" }, cache: "no-store" }); const d = await r.json(); const models: AgentModel[] = Array.isArray(d?.data) ? d.data.map((x: { id?: string; display_name?: string }): AgentModel | null => typeof x.id === "string" ? { id: x.id, name: x.display_name || x.id } : null).filter((x: AgentModel | null): x is AgentModel => Boolean(x)) : []; if (models.length) value.anthropic.models = models; } catch {} })(),
    (async () => { if (!value.gemini.configured) return; try { const client = gemini(); const pager = await client.models.list(); const models: AgentModel[] = []; for await (const m of pager) { const id = typeof m.name === "string" ? m.name.replace(/^models\//, "") : ""; if (id.startsWith("gemini") || id.startsWith("gemma")) models.push({ id, name: m.displayName || id }); } if (models.length) value.gemini.models = models; } catch {} })(),
  ]);
  catalogCache = { expires: Date.now() + 60_000, value };
  return value;
}
export async function agentProviders() { return buildCatalog(); }

function taskScores(goal: string, provider: AgentProvider, model: string) {
  const s = goal.toLowerCase();
  const coding = /\b(code|coding|debug|bug|typescript|javascript|python|sql|api|repository|repo|github|program)\b/.test(s);
  const analytics = /\b(analytics|metric|metrics|performance|statistics|stats|growth|trend|data|conversion|funnel)\b/.test(s);
  const reasoning = /\b(reason|reasoning|analy[sz]e|strategy|compare|why|architecture|plan|complex|investigate)\b/.test(s);
  const quick = s.length < 90 && /\b(what|when|where|who|how much|status|hello|hi)\b/.test(s);
  const m = model.toLowerCase();
  let score = 0;
  if (coding) score += /gpt|claude|glm/.test(m) ? 45 : 30;
  if (analytics) score += /gpt|claude|gemini|glm/.test(m) ? 38 : 28;
  if (reasoning) score += /opus|gpt-5|glm-5|pro/.test(m) ? 55 : 35;
  if (quick) score += /flash|haiku|mini|air/.test(m) ? 42 : 20;
  if (!coding && !analytics && !reasoning && !quick) score += /gpt-5|opus|pro/.test(m) ? 45 : 30;
  if (provider === "anthropic") score += reasoning || coding ? 8 : 2;
  if (provider === "openai") score += coding || reasoning ? 7 : 3;
  if (provider === "gemini") score += quick || analytics ? 7 : 2;
  if (provider === "zai") score += coding ? 5 : 1;
  if (provider === "openrouter") score += coding || reasoning ? 6 : 2;
  if (/flash|haiku|air/.test(m)) score += 3;
  return score;
}

function autoCandidates(goal: string, catalog: Record<AgentProvider, AgentProviderState>) {
  const candidates: Array<{ provider: AgentProvider; model: string; score: number }> = [];
  for (const provider of ["openai", "anthropic", "zai", "gemini", "openrouter"] as AgentProvider[]) {
    if (!catalog[provider].configured) continue;
    for (const model of catalog[provider].models) candidates.push({ provider, model: model.id, score: taskScores(goal, provider, model.id) });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function chosen(provider: AgentProvider, selected: string | undefined, catalog: Record<AgentProvider, AgentProviderState>) {
  const models = catalog[provider].models;
  return models.find((m) => m.id === selected)?.id ?? models[0]?.id;
}

async function textResponse(provider: AgentProvider, model: string, goal: string, history: AgentHistoryMessage[], orgName: string, toolContext = "") {
  const prompt = `${SYSTEM(orgName)}\n${toolContext ? `Workspace tool results:\n${toolContext}\n` : ""}${historyText(history)}\nUser: ${goal}`;
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OPENAI_API_KEY is not configured.");
    const r = await providerFetch("OpenAI", "https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, input: prompt }) });
    const d = await r.json().catch(() => null); return String(d?.output_text || "(no answer produced)");
  }
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
    const r = await providerFetch("Anthropic", "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 1200, system: SYSTEM(orgName), messages: [...history.slice(-16), { role: "user", content: `${toolContext ? `Workspace tool results:\n${toolContext}\n` : ""}${goal}` }] }) });
    const d = await r.json().catch(() => null); const text = Array.isArray(d?.content) ? d.content.find((x: { type?: string }) => x.type === "text")?.text : ""; return String(text || "(no answer produced)");
  }
  if (provider === "zai") {
    const key = process.env.ZAI_API_KEY; if (!key) throw new Error("ZAI_API_KEY is not configured.");
    const r = await providerFetch("z.ai", "https://api.z.ai/api/paas/v4/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM(orgName) }, ...history.slice(-16), { role: "user", content: `${toolContext ? `Workspace tool results:\n${toolContext}\n` : ""}${goal}` }] }) });
    const d = await r.json().catch(() => null); return String(d?.choices?.[0]?.message?.content || "(no answer produced)");
  }
  if (provider === "openrouter") return openrouterChatText({ model, system: SYSTEM(orgName), user: `${toolContext ? `Workspace tool results:\n${toolContext}\n` : ""}${historyText(history)}\nUser: ${goal}` });
  const ai = gemini(); const r = await ai.models.generateContent({ model, contents: prompt }); return r.text || "(no answer produced)";
}

function shouldUse(goal: string, keywords: string[]) { const s = goal.toLowerCase(); return keywords.some((k) => s.includes(k)); }

async function collectRequestedTools(goal: string, ctx: { db: SupabaseClient; orgId: string; orgSlug: string }): Promise<AgentStep[]> {
  const steps: AgentStep[] = [];
  const add = async (tool: string, args: Record<string, unknown> = {}) => { const result = await runTool(tool, args, ctx); steps.push({ tool, args, result }); };
  if (shouldUse(goal, ["analytics", "metric", "metrics", "performance", "conversation", "growth", "stats", "statistics"])) await add("get_analytics_summary", { days: 7 });
  if (shouldUse(goal, ["competitor", "competitors", "rival", "rivals"])) await add("get_competitors");
  if (shouldUse(goal, ["trend", "trends", "trending", "trend radar"])) await add("get_trend_radar");
  return steps;
}

export async function runGrowthAgent(goal: string, ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, options?: { provider?: AgentSelection; model?: string; history?: AgentHistoryMessage[] }): Promise<AgentRun> {
  const catalog = await buildCatalog();
  const history = options?.history ?? [];
  const steps = await collectRequestedTools(goal, ctx);
  const toolContext = steps.length ? steps.map((s) => `Tool ${s.tool}: ${JSON.stringify(s.result)}`).join("\n") : "";

  if (options?.provider === "auto" || options?.model === "auto") {
    const candidates = autoCandidates(goal, catalog);
    if (!candidates.length) throw new Error("No configured AI models are available for Auto mode.");
    let fallbackCount = 0;
    let lastError: unknown = null;
    for (const candidate of candidates) {
      try {
        const answer = await textResponse(candidate.provider, candidate.model, goal, history, ctx.orgName, toolContext);
        return { goal, provider: candidate.provider, model: candidate.model, steps, answer, auto: true, fallbackCount };
      } catch (err) {
        lastError = err;
        if (!isProviderTemporarilyUnavailable(err)) throw err;
        fallbackCount += 1;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All Auto models are temporarily unavailable.");
  }

  const provider: AgentProvider = ["openai", "anthropic", "zai", "gemini", "openrouter"].includes(options?.provider ?? "") ? options!.provider as AgentProvider : "gemini";
  if (!catalog[provider].configured) throw new Error(`${provider} is not configured on the server.`);
  const model = chosen(provider, options?.model, catalog);
  if (!model) throw new Error(`No models are available for ${provider}.`);
  const answer = await textResponse(provider, model, goal, history, ctx.orgName, toolContext);
  return { goal, provider, model, steps, answer };
}
