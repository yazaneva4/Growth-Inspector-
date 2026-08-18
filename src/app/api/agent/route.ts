import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { AgentHistoryMessage, AgentProvider, agentProviders, isProviderTemporarilyUnavailable, runGrowthAgent } from "@/lib/ai/agent";

export const maxDuration = 60;

const PROVIDERS: AgentProvider[] = ["openai", "anthropic", "zai", "gemini"];

export async function GET() {
  return NextResponse.json({ providers: await agentProviders() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const goal: string | undefined = body?.goal;
  if (!goal?.trim()) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const provider: AgentProvider = PROVIDERS.includes(body?.provider) ? body.provider : "gemini";
  const model = typeof body?.model === "string" ? body.model : undefined;
  const providers = await agentProviders();
  if (!providers[provider].configured) {
    const label = provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : "Google Gemini";
    return NextResponse.json({ error: `${label} is not configured on the server.`, temporaryUnavailable: false, provider, model }, { status: 503 });
  }

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const history: AgentHistoryMessage[] = rawHistory
    .filter((message: unknown): message is { role: string; content: string } => {
      if (!message || typeof message !== "object") return false;
      const value = message as { role?: unknown; content?: unknown };
      return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
    })
    .slice(-16)
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));

  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db.from("organizations").select("id, name").eq("slug", ctx.orgSlug).maybeSingle();
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });

  try {
    const run = await runGrowthAgent(goal, { db, orgId: org.id, orgSlug: ctx.orgSlug, orgName: org.name }, { provider, model, history });
    return NextResponse.json(run);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "agent failed";
    const temporaryUnavailable = isProviderTemporarilyUnavailable(err);
    const label = provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : "Google Gemini";
    return NextResponse.json(
      { error: temporaryUnavailable ? `${label} is temporarily unavailable because this model's quota or rate limit was reached.` : message, temporaryUnavailable, provider, model },
      { status: temporaryUnavailable ? 429 : 500 },
    );
  }
}
