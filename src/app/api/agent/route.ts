import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { AgentHistoryMessage, AgentProvider, agentProviders, runGrowthAgent } from "@/lib/ai/agent";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ providers: agentProviders() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const goal: string | undefined = body?.goal;
  if (!goal?.trim()) {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }

  const provider: AgentProvider = body?.provider === "gpt" ? "gpt" : "gemini";
  const providers = agentProviders();
  if (!providers[provider].configured) {
    const label = provider === "gpt" ? "GPT" : "Gemini";
    return NextResponse.json({ error: `${label} is not configured on the server.` }, { status: 503 });
  }

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const history: AgentHistoryMessage[] = rawHistory
    .filter((message: unknown): message is { role: string; content: string } => {
      if (!message || typeof message !== "object") return false;
      const value = message as { role?: unknown; content?: unknown };
      return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
    })
    .slice(-16)
    .map((message: { role: string; content: string }) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  if (!org) {
    return NextResponse.json({ error: "no workspace found" }, { status: 404 });
  }

  try {
    const run = await runGrowthAgent(goal, {
      db,
      orgId: org.id,
      orgSlug: ctx.orgSlug,
      orgName: org.name,
    }, {
      provider,
      history,
    });
    return NextResponse.json(run);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "agent failed" },
      { status: 500 },
    );
  }
}
