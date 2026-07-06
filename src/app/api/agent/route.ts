import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { runGrowthAgent } from "@/lib/ai/agent";

/** Runs the Growth Agent (Gemini function-calling) against the signed-in
 *  workspace, or the public demo workspace when signed out. */
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured on the server." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const goal: string | undefined = body?.goal;
  if (!goal?.trim()) {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }

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
    });
    return NextResponse.json(run);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "agent failed", detail: String(err) },
      { status: 500 },
    );
  }
}
