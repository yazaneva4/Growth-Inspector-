import type { SupabaseClient } from "@supabase/supabase-js";
import { gemini, GEMINI_MODEL } from "./gemini";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";
import { sendEmail } from "@/lib/email/send";
import { ZAI_MODEL, zaiConfigured } from "./zai";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type AgentProvider = "gemini" | "zai";

export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentRun {
  goal: string;
  provider: AgentProvider;
  model: string;
  steps: AgentStep[];
  answer: string;
}

export const TOOL_DECLARATIONS = [
  {
    name: "get_analytics_summary",
    description: "Get the workspace's conversation analytics for a recent window: volume, intents, sentiment, languages, hot leads, escalations.",
    parameters: { type: "object", properties: { days: { type: "number", description: "How many days back to summarize. Default 7." } } },
  },
  {
    name: "get_competitors",
    description: "List the competitors this workspace is tracking, with any notes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_trend_radar",
    description: "Get an AI-generated trend radar derived from the workspace's recent conversation signals.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "send_email",
    description: "Send a REAL email immediately. Only use when the goal clearly asks to email someone and the user supplied the recipient.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string", description: "Email subject line." },
        body: { type: "string", description: "Full email body as plain text." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "send_whatsapp",
    description: "Prepare a WhatsApp message and return a wa.me link. Never invent a phone number.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Full international number, digits only." },
        message: { type: "string", description: "The WhatsApp message text to pre-fill." },
      },
      required: ["phone", "message"],
    },
  },
] as const;

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string },
): Promise<unknown> {
  switch (name) {
    case "get_analytics_summary": {
      const days = typeof args.days === "number" ? args.days : 7;
      return (await getAnalytics(days, ctx.orgSlug, ctx.db)) ?? { error: "no data for this workspace" };
    }
    case "get_competitors": {
      const { data } = await ctx.db.from("competitors").select("handle, platform, notes").eq("org_id", ctx.orgId).order("created_at", { ascending: true });
      return data ?? [];
    }
    case "get_trend_radar": {
      const summary = await getAnalytics(7, ctx.orgSlug, ctx.db);
      if (!summary) return { error: "no data for this workspace" };
      return generateTrendRadar(summary);
    }
    case "send_email": {
      const to = String(args.to ?? "").trim();
      const subject = String(args.subject ?? "").trim();
      const body = String(args.body ?? "").trim();
      if (!to || !to.includes("@") || !subject || !body) return { error: "A valid recipient email, subject, and body are all required." };
      try {
        const delivered = await sendEmail({ to, subject, text: body, html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>` });
        return delivered ? { sent: true, to, subject } : { sent: false, to, note: "Email transport is not configured on the server." };
      } catch (e) {
        return { sent: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    case "send_whatsapp": {
      const digits = String(args.phone ?? "").replace(/[^\d]/g, "");
      const message = String(args.message ?? "").trim();
      if (digits.length < 8 || !message) return { error: "A full phone number with country code and a message are required." };
      return { prepared: true, phone: digits, message, whatsapp_link: `https://wa.me/${digits}?text=${encodeURIComponent(message)}` };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = (orgName: string) => [
  `You are Growth Operator for "${orgName}", a Saudi business using Growth Inspector.`,
  "You are a capable AI teammate. Have a natural conversation, remember recent chat context, and be concise but useful.",
  "Use tools whenever real workspace data is needed. Cite actual numbers or records you found.",
  "You can take actions when clearly requested: send_email sends immediately; send_whatsapp prepares a wa.me link.",
  "Never invent a recipient email or phone number. If a required value is missing, ask for it.",
  "Culturally aware for the Saudi market. Sound human and confident, not robotic.",
].join("\n");

function historyPrompt(history: AgentHistoryMessage[]): string {
  if (!history.length) return "";
  return ["Recent conversation:", ...history.slice(-16).map((m) => `${m.role === "user" ? "User" : "Growth Operator"}: ${m.content}`), ""].join("\n");
}

function isQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return ["quota", "rate limit", "rate_limit", "too many requests", "insufficient_quota", "resource exhausted", "limit exceeded", "429", "402"].some((term) => lower.includes(term));
}

export function isProviderTemporarilyUnavailable(error: unknown): boolean {
  return isQuotaError(error instanceof Error ? error.message : String(error));
}

async function runGeminiAgent(
  goal: string,
  history: AgentHistoryMessage[],
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
): Promise<AgentRun> {
  const ai = gemini();
  const steps: AgentStep[] = [];
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [{
    role: "user",
    parts: [{ text: [SYSTEM_PROMPT(ctx.orgName), historyPrompt(history), `Current user message: ${goal}`].join("\n\n") }],
  }];

  for (let i = 0; i < 6; i++) {
    try {
      const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents: contents as never, config: { tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }] } });
      const calls = res.functionCalls ?? [];
      if (!calls.length) return { goal, provider: "gemini", model: GEMINI_MODEL, steps, answer: res.text ?? "(no answer produced)" };
      contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) });
      const responseParts: Array<Record<string, unknown>> = [];
      for (const call of calls) {
        const name = call.name ?? "unknown";
        const args = (call.args ?? {}) as Record<string, unknown>;
        const result = await runTool(name, args, ctx);
        steps.push({ tool: name, args, result });
        responseParts.push({ functionResponse: { name, response: { result } } });
      }
      contents.push({ role: "user", parts: responseParts });
    } catch (error) {
      throw error;
    }
  }
  return { goal, provider: "gemini", model: GEMINI_MODEL, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request a little." };
}

function zaiTools() {
  return TOOL_DECLARATIONS.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

async function runZaiAgent(
  goal: string,
  history: AgentHistoryMessage[],
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
): Promise<AgentRun> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error("ZAI_API_KEY is not configured on the server.");
  const steps: AgentStep[] = [];
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM_PROMPT(ctx.orgName) },
    ...(history.slice(-16).map((m) => ({ role: m.role, content: m.content })) as Array<Record<string, unknown>>),
    { role: "user", content: goal },
  ];

  for (let i = 0; i < 6; i++) {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: ZAI_MODEL, messages, tools: zaiTools(), tool_choice: "auto" }),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof payload?.error === "object" && payload.error && "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : `z.ai request failed: ${response.status}`;
      throw new Error(message);
    }

    const choices = Array.isArray(payload?.choices) ? (payload.choices as Array<Record<string, unknown>>) : [];
    const message = (choices[0]?.message ?? {}) as Record<string, unknown>;
    const content = typeof message.content === "string" ? message.content : "";
    const toolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as Array<Record<string, unknown>>) : [];
    if (!toolCalls.length) return { goal, provider: "zai", model: ZAI_MODEL, steps, answer: content || "(no answer produced)" };

    messages.push(message);
    for (const toolCall of toolCalls) {
      const fn = (toolCall.function ?? {}) as Record<string, unknown>;
      const name = typeof fn.name === "string" ? fn.name : "unknown";
      const rawArgs = typeof fn.arguments === "string" ? fn.arguments : "{}";
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(rawArgs) as Record<string, unknown>; } catch { args = {}; }
      const result = await runTool(name, args, ctx);
      steps.push({ tool: name, args, result });
      messages.push({ role: "tool", tool_call_id: String(toolCall.id ?? ""), content: JSON.stringify(result) });
    }
  }

  return { goal, provider: "zai", model: ZAI_MODEL, steps, answer: "I reached my tool-step limit before finishing. Try narrowing the request a little." };
}

export function agentProviders() {
  return {
    gemini: { configured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY), model: GEMINI_MODEL },
    zai: { configured: zaiConfigured(), model: ZAI_MODEL },
  };
}

export async function runGrowthAgent(
  goal: string,
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
  options?: { provider?: AgentProvider; history?: AgentHistoryMessage[] },
): Promise<AgentRun> {
  const provider = options?.provider === "zai" ? "zai" : "gemini";
  const history = options?.history ?? [];
  return provider === "zai" ? runZaiAgent(goal, history, ctx) : runGeminiAgent(goal, history, ctx);
}
