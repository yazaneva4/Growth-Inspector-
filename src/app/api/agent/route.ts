import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgentHistoryMessage, AgentSelection, agentProviders, isProviderTemporarilyUnavailable, runGrowthAgent } from "@/lib/ai/agent";

export const maxDuration = 60;

const PROVIDERS: AgentSelection[] = ["auto", "openai", "anthropic", "zai", "gemini", "openrouter"];
const EXECUTION_MODES = ["local", "cloud", "auto"] as const;
const PERMISSION_MODES = ["ask", "auto", "skip", "manual"] as const;

type ExecutionMode = (typeof EXECUTION_MODES)[number];
type PermissionMode = (typeof PERMISSION_MODES)[number];

function cookieValue(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value;
}

async function requireSignedIn() {
  const ctx = await getCurrentContext();
  if (ctx.isDemo || !ctx.userId) return null;
  return ctx;
}

export async function GET() {
  const ctx = await requireSignedIn();
  if (!ctx) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const providers = await agentProviders();
  const pickerProviders = Object.fromEntries(
    Object.entries(providers).map(([provider, state]) => [
      provider,
      { ...state, models: [{ id: "auto", name: "⚡ Auto — best available" }, ...state.models.filter((model) => model.id !== "auto")] },
    ]),
  );
  return NextResponse.json({
    providers: pickerProviders,
    auto: { id: "auto", name: "⚡ Auto", description: "Chooses the best available model for the task and falls back automatically when quota or rate limits are reached." },
    execution: { modes: EXECUTION_MODES, defaultMode: "auto", localHealth: "http://127.0.0.1:8787/health" },
    permissions: { modes: PERMISSION_MODES, defaultMode: "ask", skipDescription: "Skip all permissions disables permission prompts for the agent." },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const ctx = await requireSignedIn();
  if (!ctx) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const goal: string | undefined = body?.goal;
  if (!goal?.trim()) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const provider: AgentSelection = PROVIDERS.includes(body?.provider) ? body.provider : "gemini";
  const model = typeof body?.model === "string" ? body.model : undefined;
  const requestedMode = cookieValue(req, "growth_ai_agent_mode");
  const executionMode: ExecutionMode = EXECUTION_MODES.includes(requestedMode as ExecutionMode) ? requestedMode as ExecutionMode : "auto";
  const requestedPermission = cookieValue(req, "growth_ai_permission_mode");
  const permissionMode: PermissionMode = PERMISSION_MODES.includes(requestedPermission as PermissionMode) ? requestedPermission as PermissionMode : "ask";
  const providers = await agentProviders();

  if (executionMode === "local") {
    return NextResponse.json({ error: "Local Agent is required for Local Mode. The local browser agent is offline or not connected to this session.", localAgentRequired: true, executionMode, permissionMode }, { status: 409 });
  }

  if (provider !== "auto" && !providers[provider].configured) {
    const label = provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : provider === "openrouter" ? "OpenRouter" : "Google Gemini";
    return NextResponse.json({ error: `${label} is not configured on the server.`, temporaryUnavailable: false, provider, model, executionMode, permissionMode }, { status: 503 });
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

  const db = await createClient();
  const { data: org } = await db.from("organizations").select("id, name, brand_voice").eq("slug", ctx.orgSlug).maybeSingle();
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });

  const brandVoice = org.brand_voice && typeof org.brand_voice === "object" ? org.brand_voice as { instructions?: unknown } : {};
  const instructions = typeof brandVoice.instructions === "string" ? brandVoice.instructions.trim().slice(0, 8000) : "";
  const goalForAgent = instructions
    ? `${goal.trim()}\n\nWorkspace Growth AI instructions (follow these as workspace preferences):\n${instructions}`
    : goal.trim();

  try {
    const run = await runGrowthAgent(goalForAgent, { db, orgId: org.id, orgSlug: ctx.orgSlug, orgName: org.name }, { provider, model, history });
    return NextResponse.json({ ...run, executionMode, permissionMode });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "agent failed";
    const temporaryUnavailable = isProviderTemporarilyUnavailable(err);
    const label = provider === "auto" || model === "auto" ? "Auto mode" : provider === "openai" ? "GPT" : provider === "anthropic" ? "Anthropic" : provider === "zai" ? "z.ai" : provider === "openrouter" ? "OpenRouter" : "Google Gemini";
    return NextResponse.json({ error: temporaryUnavailable ? `${label} is temporarily unavailable because quota or rate limits were reached.` : message, temporaryUnavailable, provider, model, executionMode, permissionMode }, { status: temporaryUnavailable ? 429 : 500 });
  }
}
