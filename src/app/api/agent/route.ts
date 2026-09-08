import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runFreeGrowthAgent } from "@/lib/ai/free-agent";

export const maxDuration = 60;

const FREE_PROVIDERS = {
  opencode: { configured: true, models: [{ id: "big-pickle", name: "OpenCode Zen · Big Pickle (Free)" }] },
  openrouter: { configured: Boolean(process.env.OPENROUTER_API_KEY), models: [{ id: "openrouter/free", name: "OpenRouter Free Models Router" }] },
};

export async function GET() {
  return NextResponse.json({
    providers: FREE_PROVIDERS,
    auto: { id: "auto", name: "Free Auto", description: "Uses OpenCode Zen Big Pickle first, then OpenRouter Free Models Router when the first route is unavailable or rate-limited." },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentContext();
  if (!ctx.userId || ctx.isDemo) return NextResponse.json({ error: "Sign in to use Growth AI." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  if (!goal) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const history = Array.isArray(body?.history)
    ? body.history.filter((m: unknown): m is { role: "user" | "assistant"; content: string } => Boolean(m && typeof m === "object" && (((m as { role?: unknown }).role === "user") || ((m as { role?: unknown }).role === "assistant")) && typeof (m as { content?: unknown }).content === "string")).slice(-32)
    : [];

  const db = await createClient();
  const { data: org, error: orgError } = await db.from("organizations").select("id, slug, name").eq("slug", ctx.orgSlug).maybeSingle();
  if (orgError || !org) return NextResponse.json({ error: "Workspace could not be loaded." }, { status: 500 });

  try {
    const result = await runFreeGrowthAgent({
      goal,
      history,
      orgName: org.name || ctx.orgName || "Growth Inspector",
      orgId: org.id,
      orgSlug: org.slug,
      db,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Free Growth AI failed:", error);
    return NextResponse.json({ error: "Free AI services are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
