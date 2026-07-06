import type { SupabaseClient } from "@supabase/supabase-js";
import { gemini, GEMINI_MODEL } from "./gemini";
import { getAnalytics } from "@/lib/analytics";
import { generateTrendRadar } from "@/lib/ai/trends";

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

/** Read-only tools the Growth Agent can call — no writes, nothing destructive. */
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
            `You are the Growth Agent for "${ctx.orgName}", a Saudi business using Growth Inspector.`,
            "Use the available tools to gather whatever real data you need, then give a concrete,",
            "actionable answer to the user's goal. Cite the actual numbers you found. Keep it tight.",
            "Culturally aware for the Saudi market (Fri/Sat weekend, Arabic dialect, local occasions).",
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
