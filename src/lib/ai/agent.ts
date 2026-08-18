import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { gemini, GEMINI_MODEL } from "./gemini";
import { ZAI_MODEL, zaiConfigured } from "./zai";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";
import { sendEmail } from "@/lib/email/send";

function escapeHtml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export type AgentProvider = "openai" | "anthropic" | "zai" | "gemini";
export type AgentModel = { id: string; name: string };
export type AgentProviderState = { configured: boolean; models: AgentModel[] };
export interface AgentStep { tool: string; args: Record<string, unknown>; result: unknown; }
export interface AgentHistoryMessage { role: "user" | "assistant"; content: string; }
export interface AgentRun { goal: string; provider: AgentProvider; model: string; steps: AgentStep[]; answer: string; }

const ZAI_MODELS: AgentModel[] = [
  ["glm-5.1", "GLM-5.1"], ["glm-5", "GLM-5"], ["glm-5-turbo", "GLM-5 Turbo"], ["glm-4.7", "GLM-4.7"],
  ["glm-4.7-flash", "GLM-4.7 Flash"], ["glm-4.7-flashx", "GLM-4.7 FlashX"], ["glm-4.6", "GLM-4.6"],
  ["glm-4.5", "GLM-4.5"], ["glm-4.5-air", "GLM-4.5 Air"], ["glm-4.5-x", "GLM-4.5 X"],
  ["glm-4.5-airx", "GLM-4.5 AirX"], ["glm-4.5-flash", "GLM-4.5 Flash"], ["glm-4-32b-0414-128k", "GLM-4 32B"],
].map(([id, name]) => ({ id, name }));

export const TOOL_DECLARATIONS = [
  { name: "get_analytics_summary", description: "Get workspace conversation analytics for a recent window.", parameters: { type: "object", properties: { days: { type: "number" } } } },
  { name: "get_competitors", description: "List tracked competitors and notes.", parameters: { type: "object", properties: {} } },
  { name: "get_trend_radar", description: "Get the workspace trend radar from recent conversation signals.", parameters: { type: "object", properties: {} } },
  { name: "send_email", description: "Send a real email only when explicitly requested with a user-supplied recipient.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  { name: "send_whatsapp", description: "Prepare a WhatsApp message and return a wa.me link. Never invent a phone number.", parameters: { type: "object", properties: { phone: { type: "string" }, message: { type: "string" } }, required: ["phone", "message"] } },
] as const;

const SYSTEM_PROMPT = (orgName: string) => [
  `You are Growth Operator for "${orgName}", a Saudi business using Growth Inspector.`,
  "Have a natural multi-turn conversation and remember recent chat context.",
  "Use tools when real workspace data is needed and cite the actual numbers.",
  "Take actions only when explicitly requested. Never invent email addresses or phone numbers.",
  "Be concise, practical, culturally aware, and human-sounding.",
].join("\n");

function historyPrompt(history: AgentHistoryMessage[]) { return history.length ? ["Recent conversation:", ...history.slice(-16).map((m) => `${m.role === "user" ? "User" : "Growth Operator"}: ${m.content}`)].join("\n") : ""; }
function isQuotaError(message: string) { const l = message.toLowerCase(); return ["quota", "rate limit", "rate_limit", "too many requests", "insufficient_quota", "resource exhausted", "limit exceeded", "429", "402", "credit balance", "insufficient balance", "recharge", "billing"].some((term) => l.includes(term)); }
export function isProviderTemporarilyUnavailable(error: unknown) { return isQuotaError(error instanceof Error ? error.message : String(error)); }

export async function runTool(name: string, args: Record<string, unknown>, ctx: { db: SupabaseClient; orgId: string; orgSlug: string }) {
  switch (name) {
    case "get_analytics_summary": return (await getAnalytics(typeof args.days === "number" ? args.days : 7, ctx.orgSlug, ctx.db)) ?? { error: "no data for this workspace" };
    case "get_competitors": { const { data } = await ctx.db.from("competitors").select("handle, platform, notes").eq("org_id", ctx.orgId).order("created_at", { ascending: true }); return data ?? []; }
    case "get_trend_radar": { const summary = await getAnalytics(7, ctx.orgSlug, ctx.db); return summary ? generateTrendRadar(summary) : { error: "no data for this workspace" }; }
    case "send_email": {
      const to = String(args.to ?? "").trim(), subject = String(args.subject ?? "").trim(), body = String(args.body ?? "").trim();
      if (!to || !to.includes("@") || !subject || !body) return { error: "A valid recipient email, subject, and body are required." };
      try { const sent = await sendEmail({ to, subject, text: body, html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>` }); return sent ? { sent: true, to, subject } : { sent: false, to, note: "Email transport is not configured." }; }
      catch (e) { return { sent: false, error: e instanceof Error ? e.message : String(e) }; }
    }
    case "send_whatsapp": { const phone = String(args.phone ?? "").replace(/[^\d]/g, ""), message = String(args.message ?? "").trim(); if (phone.length < 8 || !message) return { error: "A full phone number with country code and a message are required." }; return { prepared: true, phone, message, whatsapp_link: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` }; }
    default: return { error: `unknown tool: ${name}` };
  }
}

function fallbackModels(provider: AgentProvider): AgentModel[] {
  if (provider === "zai") return ZAI_MODELS;
  if (provider === "gemini") return [
    ["gemini-3.6-flash", "Gemini 3.6 Flash"], ["gemini-3.5-flash", "Gemini 3.5 Flash"], ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite"],
    ["gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview"], ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"], ["gemini-3-flash-preview", "Gemini 3 Flash Preview"],
    ["gemini-2.5-pro", "Gemini 2.5 Pro"], ["gemini-2.5-flash", "Gemini 2.5 Flash"], ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"], ["gemma-4-31b-it", "Gemma 4 31B IT"],
  ].map(([id, name]) => ({ id, name }));
  if (provider === "anthropic") return [
    ["claude-opus-4-8", "Claude Opus 4.8"], ["claude-opus-4-7", "Claude Opus 4.7"], ["claude-opus-4-6", "Claude Opus 4.6"], ["claude-sonnet-4-6", "Claude Sonnet 4.6"], ["claude-haiku-4-5", "Claude Haiku 4.5"], ["claude-opus-4-5", "Claude Opus 4.5"], ["claude-sonnet-4-5", "Claude Sonnet 4.5"],
  ].map(([id, name]) => ({ id, name }));
  return [{ id: "gpt-5.6", name: "GPT-5.6" }];
}

let catalogCache: { expires: number; value: Record<AgentProvider, AgentProviderState> } | null = null;
async function fetchProviderModels(): Promise<Record<AgentProvider, AgentProviderState>> {
  if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
  const result: Record<AgentProvider, AgentProviderState> = {
    openai: { configured: Boolean(process.env.OPENAI_API_KEY), models: fallbackModels("openai") },
    anthropic: { configured: Boolean(process.env.ANTHROPIC_API_KEY), models: fallbackModels("anthropic") },
    zai: { configured: zaiConfigured(), models: ZAI_MODELS },
    gemini: { configured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY), models: fallbackModels("gemini") },
  };
  await Promise.all([
    (async () => { if (!result.openai.configured) return; try { const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, cache: "no-store" }); const d = await r.json(); const ids = Array.isArray(d?.data) ? d.data.map((x: { id?: string }) => x.id).filter((id: unknown): id is string => typeof id === "string" && (/^(gpt|o[1-9])/.test(id))) : []; if (ids.length) result.openai.models = ids.sort().map((id) => ({ id, name: id })); } catch {} })(),
    (async () => { if (!result.anthropic.configured) return; try { const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": String(process.env.ANTHROPIC_API_KEY), "anthropic-version": "2023-06-01" }, cache: "no-store" }); const d = await r.json(); const ids = Array.isArray(d?.data) ? d.data.map((x: { id?: string; display_name?: string }) => ({ id: x.id, name: x.display_name || x.id })).filter((x: { id?: string }): x is { id: string; name: string } => typeof x.id === "string") : []; if (ids.length) result.anthropic.models = ids; } catch {} })(),
    (async () => { if (!result.gemini.configured) return; try { const client = gemini(); const pager = await client.models.list(); const models: AgentModel[] = []; for await (const m of pager) { const id = typeof m.name === "string" ? m.name.replace(/^models\//, "") : ""; if (id && id.startsWith("gemini")) models.push({ id, name: m.displayName || id }); } if (models.length) result.gemini.models = models; } catch {} })(),
  ]);
  catalogCache = { expires: Date.now() + 60_000, value: result };
  return result;
}

export async function agentProviders() { return fetchProviderModels(); }

function chooseModel(provider: AgentProvider, selected?: string, catalog?: Record<AgentProvider, AgentProviderState>) {
  const models = catalog?.[provider].models ?? fallbackModels(provider);
  return models.some((m) => m.id === selected) && selected ? selected : models[0].id;
}

async function runGeminiAgent(goal: string, history: AgentHistoryMessage[], ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, model: string): Promise<AgentRun> {
  const ai = gemini(), steps: AgentStep[] = [], contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [{ role: "user", parts: [{ text: [SYSTEM_PROMPT(ctx.orgName), historyPrompt(history), `Current user message: ${goal}`].join("\n\n") }] }];
  for (let i = 0; i < 6; i++) { const res = await ai.models.generateContent({ model, contents: contents as never, config: { tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }] } }); const calls = res.functionCalls ?? []; if (!calls.length) return { goal, provider: "gemini", model, steps, answer: res.text ?? "(no answer produced)" }; contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) }); const responseParts: Array<Record<string, unknown>> = []; for (const c of calls) { const name = c.name ?? "unknown", args = (c.args ?? {}) as Record<string, unknown>, result = await runTool(name, args, ctx); steps.push({ tool: name, args, result }); responseParts.push({ functionResponse: { name, response: { result } } }); } contents.push({ role: "user", parts: responseParts }); }
  return { goal, provider: "gemini", model, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request." };
}

function openAITools() { return TOOL_DECLARATIONS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters })); }
async function runOpenAI(goal: string, history: AgentHistoryMessage[], ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, model: string): Promise<AgentRun> {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OPENAI_API_KEY is not configured on the server.");
  let input: Array<Record<string, unknown>> = [{ role: "user", content: [{ type: "input_text", text: [SYSTEM_PROMPT(ctx.orgName), historyPrompt(history), `Current user message: ${goal}`].join("\n\n") }] }]; const steps: AgentStep[] = [];
  for (let i = 0; i < 6; i++) { const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, input, tools: openAITools() }) }); const d = await r.json().catch(() => null) as Record<string, unknown> | null; if (!r.ok) throw new Error(typeof d?.error === "object" && d?.error && "message" in d.error ? String((d.error as { message: unknown }).message) : `OpenAI request failed: ${r.status}`); const output = Array.isArray(d?.output) ? d.output as Array<Record<string, unknown>> : [], text = typeof d?.output_text === "string" ? d.output_text : "", calls = output.filter((x) => x.type === "function_call"); if (!calls.length) return { goal, provider: "openai", model, steps, answer: text || "(no answer produced)" }; input = [...input, ...output]; for (const call of calls) { const name = typeof call.name === "string" ? call.name : "unknown"; let args: Record<string, unknown> = {}; try { args = JSON.parse(typeof call.arguments === "string" ? call.arguments : "{}") as Record<string, unknown>; } catch {} const result = await runTool(name, args, ctx); steps.push({ tool: name, args, result }); input.push({ type: "function_call_output", call_id: String(call.call_id ?? ""), output: JSON.stringify(result) }); } }
  return { goal, provider: "openai", model, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request." };
}

function anthropicTools() { return TOOL_DECLARATIONS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })); }
async function runAnthropic(goal: string, history: AgentHistoryMessage[], ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, model: string): Promise<AgentRun> {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  let messages: Array<Record<string, unknown>> = [{ role: "user", content: [historyPrompt(history), `Current user message: ${goal}`].filter(Boolean).join("\n\n") }]; const steps: AgentStep[] = [];
  for (let i = 0; i < 6; i++) { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM_PROMPT(ctx.orgName), tools: anthropicTools(), messages }) }); const d = await r.json().catch(() => null) as Record<string, unknown> | null; if (!r.ok) throw new Error(typeof d?.error === "object" && d?.error && "message" in d.error ? String((d.error as { message: unknown }).message) : `Anthropic request failed: ${r.status}`); const content = Array.isArray(d?.content) ? d.content as Array<Record<string, unknown>> : []; const toolUses = content.filter((x) => x.type === "tool_use"); const text = content.filter((x) => x.type === "text").map((x) => String(x.text ?? "")).join("\n"); if (!toolUses.length) return { goal, provider: "anthropic", model, steps, answer: text || "(no answer produced)" }; messages.push({ role: "assistant", content }); const results: Array<Record<string, unknown>> = []; for (const t of toolUses) { const name = String(t.name ?? "unknown"), args = (t.input ?? {}) as Record<string, unknown>, result = await runTool(name, args, ctx); steps.push({ tool: name, args, result }); results.push({ type: "tool_result", tool_use_id: String(t.id ?? ""), content: JSON.stringify(result) }); } messages.push({ role: "user", content: results }); }
  return { goal, provider: "anthropic", model, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request." };
}

function zaiTools() { return TOOL_DECLARATIONS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })); }
async function runZai(goal: string, history: AgentHistoryMessage[], ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, model: string): Promise<AgentRun> {
  const key = process.env.ZAI_API_KEY; if (!key) throw new Error("ZAI_API_KEY is not configured on the server.");
  const messages: Array<Record<string, unknown>> = [{ role: "system", content: SYSTEM_PROMPT(ctx.orgName) }, ...history.slice(-16).map((m) => ({ role: m.role, content: m.content })), { role: "user", content: goal }]; const steps: AgentStep[] = [];
  for (let i = 0; i < 6; i++) { const r = await fetch("https://api.z.ai/api/paas/v4/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, tools: zaiTools(), tool_choice: "auto" }) }); const d = await r.json().catch(() => null) as Record<string, unknown> | null; if (!r.ok) throw new Error(typeof d?.error === "object" && d?.error && "message" in d.error ? String((d.error as { message: unknown }).message) : `z.ai request failed: ${r.status}`); const choices = Array.isArray(d?.choices) ? d.choices as Array<Record<string, unknown>> : [], msg = (choices[0]?.message ?? {}) as Record<string, unknown>, text = typeof msg.content === "string" ? msg.content : "", calls = Array.isArray(msg.tool_calls) ? msg.tool_calls as Array<Record<string, unknown>> : []; if (!calls.length) return { goal, provider: "zai", model, steps, answer: text || "(no answer produced)" }; messages.push(msg); for (const call of calls) { const fn = (call.function ?? {}) as Record<string, unknown>, name = typeof fn.name === "string" ? fn.name : "unknown"; let args: Record<string, unknown> = {}; try { args = JSON.parse(typeof fn.arguments === "string" ? fn.arguments : "{}") as Record<string, unknown>; } catch {} const result = await runTool(name, args, ctx); steps.push({ tool: name, args, result }); messages.push({ role: "tool", tool_call_id: String(call.id ?? ""), content: JSON.stringify(result) }); } }
  return { goal, provider: "zai", model, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request." };
}

export async function agentProviders() {
  return fetchProviderModels();
}

export async function fetchProviderModels(): Promise<Record<AgentProvider, AgentProviderState>> {
  if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
  const value: Record<AgentProvider, AgentProviderState> = {
    openai: { configured: Boolean(process.env.OPENAI_API_KEY), models: fallbackModels("openai") },
    anthropic: { configured: Boolean(process.env.ANTHROPIC_API_KEY), models: fallbackModels("anthropic") },
    zai: { configured: zaiConfigured(), models: ZAI_MODELS },
    gemini: { configured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY), models: fallbackModels("gemini") },
  };
  await Promise.all([
    (async () => { if (!value.openai.configured) return; try { const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, cache: "no-store" }); const d = await r.json(); const ids = Array.isArray(d?.data) ? d.data.map((x: { id?: string }) => x.id).filter((id: unknown): id is string => typeof id === "string" && (/^(gpt|o[1-9])/.test(id))) : []; if (ids.length) value.openai.models = ids.sort().map((id) => ({ id, name: id })); } catch {} })(),
    (async () => { if (!value.anthropic.configured) return; try { const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": String(process.env.ANTHROPIC_API_KEY), "anthropic-version": "2023-06-01" }, cache: "no-store" }); const d = await r.json(); const models = Array.isArray(d?.data) ? d.data.map((x: { id?: string; display_name?: string }) => ({ id: x.id, name: x.display_name || x.id })).filter((x: { id?: string }): x is { id: string; name: string } => typeof x.id === "string") : []; if (models.length) value.anthropic.models = models; } catch {} })(),
    (async () => { if (!value.gemini.configured) return; try { const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY }); const pager = await client.models.list(); const models: AgentModel[] = []; for await (const m of pager) { const id = typeof m.name === "string" ? m.name.replace(/^models\//, "") : ""; if (id.startsWith("gemini") || id.startsWith("gemma")) models.push({ id, name: m.displayName || id }); } if (models.length) value.gemini.models = models; } catch {} })(),
  ]);
  catalogCache = { expires: Date.now() + 60_000, value };
  return value;
}

let catalogCache: { expires: number; value: Record<AgentProvider, AgentProviderState> } | null = null;

export async function runGrowthAgent(goal: string, ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string }, options?: { provider?: AgentProvider; model?: string; history?: AgentHistoryMessage[] }): Promise<AgentRun> {
  const provider: AgentProvider = ["openai", "anthropic", "zai", "gemini"].includes(options?.provider ?? "") ? options!.provider! : "gemini";
  const catalog = await fetchProviderModels(); const model = chooseModel(provider, options?.model, catalog); const history = options?.history ?? [];
  if (!catalog[provider].configured) throw new Error(`${provider} is not configured on the server.`);
  if (provider === "openai") return runOpenAI(goal, history, ctx, model);
  if (provider === "anthropic") return runAnthropic(goal, history, ctx, model);
  if (provider === "zai") return runZai(goal, history, ctx, model);
  return runGeminiAgent(goal, history, ctx, model);
}
