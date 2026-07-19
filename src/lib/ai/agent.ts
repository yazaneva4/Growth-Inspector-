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

export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentRun {
  goal: string;
  steps: AgentStep[];
  answer: string;
}

/** Tools the Growth Agent can call — read-only research PLUS two real
 *  actions (send an email, prepare a WhatsApp message). */
const TOOL_DECLARATIONS = [
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
      "Send a REAL email immediately (not a draft) from the business to a recipient. Use ONLY when the goal clearly asks to email someone, and only with an address the user actually provided — never invent a recipient. Write a clear subject and a complete, professional body.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address (must be real / user-provided)." },
        subject: { type: "string", description: "Email subject line." },
        body: { type: "string", description: "Full, professional email body as plain text." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "send_whatsapp",
    description:
      "Prepare a WhatsApp message and return a link that opens WhatsApp with the text ready to send. Use when the goal asks to WhatsApp/message someone. Provide the full international number, digits only, INCLUDING the country code (Saudi Arabia is 966) — never invent a number.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Full number with country code, digits only, e.g. 966501234567.",
        },
        message: { type: "string", description: "The WhatsApp message text to pre-fill." },
      },
      required: ["phone", "message"],
    },
  },
] as const;

async function runTool(
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
          : { sent: false, to, note: "Email transport isn't configured on the server (dry-run — nothing was actually sent)." };
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

/**
 * The Growth Agent: given a goal in plain English, autonomously calls
 * read-only tools (analytics, competitors, trends) via Gemini function-calling
 * until it has enough to answer, then returns a synthesized report plus the
 * step-by-step trace of what it looked up.
 */
export async function runGrowthAgent(
  goal: string,
  ctx: { db: SupabaseClient; orgId: string; orgSlug: string; orgName: string },
): Promise<AgentRun> {
  const ai = gemini();
  const steps: AgentStep[] = [];

  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    {
      role: "user",
      parts: [
        {
          text: [
            `You are Growth Operator for "${ctx.orgName}", a Saudi business using Growth Inspector.`,
            "Use the available tools to gather whatever real data you need, then give a concrete,",
            "actionable answer to the user's goal. Cite the actual numbers you found. Keep it tight.",
            "Culturally aware for the Saudi market (Fri/Sat weekend, Arabic dialect, local occasions).",
            "",
            "You can also TAKE ACTIONS, not just advise:",
            "- send_email sends a real email right away (no draft).",
            "- send_whatsapp prepares a WhatsApp message the user can open and send.",
            "Only take an action when the goal clearly asks for it. NEVER invent a",
            "recipient email or phone number — if you don't have one, ask the user for",
            "it instead of guessing. Draft any email/message in a warm, professional",
            "tone suited to the Saudi market.",
            "",
            "When you finish — especially after taking an action — close your answer",
            "with a short, natural, professional check-in: say plainly what you did",
            "and ask whether it worked or if they'd like you to adjust the wording.",
            "Sound human and confident, not robotic.",
            "",
            `Goal: ${goal}`,
          ].join("\n"),
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
      return { goal, steps, answer: res.text ?? "(no answer produced)" };
    }

    // Record the model's turn (the function call requests) then execute each.
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
    steps,
    answer: "Reached the step limit before finishing — try narrowing the goal.",
  };
}
