import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { AgentHistoryMessage, AgentSelection, agentProviders, isProviderTemporarilyUnavailable, runGrowthAgent } from "@/lib/ai/agent";

export const maxDuration = 60;

const PROVIDERS: AgentSelection[] = ["auto", "openai", "anthropic", "zai", "gemini"];

export async function GET() {
  const providers = await agentProviders();
  return NextResponse.json({
    providers,
    auto: { id: "auto", name: "⚡ Auto", description: "Chooses the best available model and falls back automatically when a model is temporarily unavailable." },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const goal: string | undefined = body?.goal;
  if (!goal?.trim()) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const provider: AgentSelection = PROVIDERS.includes(body?.provider) ? body.provider : "gemini";
  const model = typeof body?.model === "string" ? body.model : undefined;
  const providers = await agentProviders();

  if (provider !== "auto" && !providers[provider].configured) {
    const label = provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : "Google Gemini";
    return NextResponse.json({ error: `${label} is not configured on the server.`, temporaryUnavailable: false, provider, model }, { status: 503 });
  }

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const history: AgentHistoryMessage[] = rawHistory
    .filter((message: unknown): message is { role: "user" | "assistant"; content: string } => {
      if (!message || typeof message !== "object") return false;
      const value = message as { role?: unknown; content?: unknown };
      return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
    })
    .slice(-16)
    .map((message: { role: "user" | "assistant"; content: string }): AgentHistoryMessage => ({ role: message.role, content: message.content }));

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
    const label = provider === "auto" ? "The selected AI models" : provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : "Google Gemini";
    return NextResponse.json(
      { error: temporaryUnavailable ? `${label} are temporarily unavailable because quota or rate limits were reached.` : message, temporaryUnavailable, provider, model },
      { status: temporaryUnavailable ? 429 : 500 },
    );
  }
}
