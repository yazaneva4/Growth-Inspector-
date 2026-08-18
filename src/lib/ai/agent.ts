import type { SupabaseClient } from "@supabase/supabase-js";
import { gemini, GEMINI_MODEL } from "./gemini";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";
import { sendEmail } from "@/lib/email/send";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type AgentProvider = "gemini" | "gpt";

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

/** Tools the Growth Operator can call — research plus real actions. */
export const TOOL_DECLARATIONS = [
  {
    name: "get_analytics_summary",
    description:
      "Get the workspace's conversation analytics for a recent window: volume, intents, sentiment, languages, hot leads, escalations.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days back to summarize. Default 7." },
      },
    },
  },
  {
    name: "get_competitors",
    description: "List the competitors this workspace is tracking, with any notes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_trend_radar",
    description:
      "Get an AI-generated trend radar (rising themes + suggested content moves + hashtags) derived from the workspace's recent conversation signals.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "send_email",
    description:
      "Send a REAL email immediately (not a draft) from the business to a recipient. Use ONLY when the goal clearly asks to email someone, and only with an address the user actually provided — never invent a recipient.",
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
    description:
      "Prepare a WhatsApp message and return a link that opens WhatsApp with the text ready to send. Use when the goal asks to WhatsApp/message someone. Provide the full international number, digits only, including the country code.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Full number with country code, digits only.",
        },
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
      const summary = await getAnalytics(days, ctx.orgSlug, ctx.db);
      return summary ?? { error: "no data for this workspace" };
    }
    case "get_competitors": {
      const { data } = await ctx.db
        .from("competitors")
        .select("handle, platform, notes")
        .eq("org_id", ctx.orgId)
        .order("created_at", { ascending: true });
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
      if (!to || !to.includes("@") || !subject || !body) {
        return { error: "A valid recipient email, subject, and body are all required." };
      }
      try {
        const delivered = await sendEmail({
          to,
          subject,
          text: body,
          html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</div>`,
        });
        return delivered
          ? { sent: true, to, subject }
          : { sent: false, to, note: "Email transport is not configured on the server." };
      } catch (e) {
        return { sent: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    case "send_whatsapp": {
      const digits = String(args.phone ?? "").replace(/[^\d]/g, "");
      const message = String(args.message ?? "").trim();
      if (digits.length < 8 || !message) {
        return { error: "A full phone number with country code and a message are required." };
      }
      return {
        prepared: true,
        phone: digits,
        message,
        whatsapp_link: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = (orgName: string) =>
  [
    `You are Growth Operator for "${orgName}", a Saudi business using Growth Inspector.`,
    "You are a capable AI teammate. Have a natural conversation, remember the recent chat context, and be concise but useful.",
    "Use the available tools whenever real workspace data is needed. Cite the actual numbers or records you found.",
    "You can take actions when clearly requested: send_email sends immediately; send_whatsapp prepares a wa.me link.",
    "Never invent a recipient email or phone number. If a required value is missing, ask for it.",
    "Culturally aware for the Saudi market. Sound human and confident, not robotic.",
  ].join("\n");

function historyPrompt(history: AgentHistoryMessage[]): string {
  if (history.length === 0) return "";
  return [
    "Recent conversation:",
    ...history.slice(-16).map((m) => `${m.role === "user" ? "User" : "Growth Operator"}: ${m.content}`),
    "",
  ].join("\n");
}

async function runGeminiAgent(
  goal: string,
  history: AgentHistoryMessage[],
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
): Promise<AgentRun> {
  const ai = gemini();
  const steps: AgentStep[] = [];
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    {
      role: "user",
      parts: [
        {
          text: [SYSTEM_PROMPT(ctx.orgName), historyPrompt(history), `Current user message: ${goal}`].join("\n\n"),
        },
      ],
    },
  ];

  const MAX_STEPS = 6;
  for (let i = 0; i < MAX_STEPS; i++) {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents as never,
      config: { tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }] },
    });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      return { goal, provider: "gemini", model: GEMINI_MODEL, steps, answer: res.text ?? "(no answer produced)" };
    }

    contents.push({
      role: "model",
      parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
    });

    const responseParts: Array<Record<string, unknown>> = [];
    for (const call of calls) {
      const name = call.name ?? "unknown";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const result = await runTool(name, args, ctx);
      steps.push({ tool: name, args, result });
      responseParts.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    goal,
    provider: "gemini",
    model: GEMINI_MODEL,
    steps,
    answer: "I reached my tool-step limit before finishing. Try narrowing the request a little.",
  };
}

function openAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function openAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.6";
}

function openAITools() {
  return TOOL_DECLARATIONS.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

async function runOpenAIAgent(
  goal: string,
  history: AgentHistoryMessage[],
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
): Promise<AgentRun> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const model = openAIModel();
  const steps: AgentStep[] = [];
  let input: Array<Record<string, unknown>> = [
    { role: "user", content: [{ type: "input_text", text: [SYSTEM_PROMPT(ctx.orgName), historyPrompt(history), `Current user message: ${goal}`].join("\n\n") }] },
  ];

  for (let i = 0; i < 6; i++) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        tools: openAITools(),
      }),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof payload?.error === "object" && payload.error && "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : "OpenAI request failed";
      throw new Error(message);
    }

    const output = Array.isArray(payload?.output) ? (payload.output as Array<Record<string, unknown>>) : [];
    const text = typeof payload?.output_text === "string" ? payload.output_text : "";
    const calls = output.filter((item) => item.type === "function_call");

    if (calls.length === 0) {
      return { goal, provider: "gpt", model, steps, answer: text || "(no answer produced)" };
    }

    input = [...input, ...output];
    for (const call of calls) {
      const name = typeof call.name === "string" ? call.name : "unknown";
      const rawArgs = typeof call.arguments === "string" ? call.arguments : "{}";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await runTool(name, args, ctx);
      steps.push({ tool: name, args, result });
      input.push({ type: "function_call_output", call_id: String(call.call_id ?? ""), output: JSON.stringify(result) });
    }
  }

  return {
    goal,
    provider: "gpt",
    model,
    steps,
    answer: "I reached my tool-step limit before finishing. Try narrowing the request a little.",
  };
}

export function agentProviders() {
  return {
    gemini: { configured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY), model: GEMINI_MODEL },
    gpt: { configured: openAIConfigured(), model: openAIModel() },
  };
}

export async function runGrowthAgent(
  goal: string,
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
  options?: { provider?: AgentProvider; history?: AgentHistoryMessage[] },
): Promise<AgentRun> {
  const provider = options?.provider === "gpt" ? "gpt" : "gemini";
  const history = options?.history ?? [];

  if (provider === "gpt") {
    return runOpenAIAgent(goal, history, ctx);
  }

  return runGeminiAgent(goal, history, ctx);
}
