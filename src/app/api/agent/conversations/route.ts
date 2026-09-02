import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function getDbAndOrg() {
  const ctx = await getCurrentContext();
  // The public demo has no auth.uid(), so only its fixed demo workspace uses
  // the server-only client. Authenticated workspaces stay behind RLS.
  const db = ctx.isDemo ? createServiceClient() : await createClient();
  const { data: org } = await db.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  return { db, org };
}

export async function GET() {
  const { db, org } = await getDbAndOrg();
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });
  const { data, error } = await db.from("ai_operator_conversations").select("id,title,archived,created_at,updated_at,ai_operator_messages(id,role,content,provider,model,steps,created_at)").eq("org_id", org.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { db, org } = await getDbAndOrg();
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });
  const action = body?.action;

  if (action === "create") {
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "New conversation";
    const { data, error } = await db.from("ai_operator_conversations").insert({ org_id: org.id, title }).select("id,title,archived,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversation: data });
  }

  if (action === "message") {
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const role = body?.role === "assistant" ? "assistant" : body?.role === "user" ? "user" : null;
    const content = typeof body?.content === "string" ? body.content : "";
    if (!conversationId || !role || !content.trim()) return NextResponse.json({ error: "invalid message" }, { status: 400 });
    const { data: conversation } = await db.from("ai_operator_conversations").select("id").eq("id", conversationId).eq("org_id", org.id).maybeSingle();
    if (!conversation) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    const { data, error } = await db.from("ai_operator_messages").insert({ org_id: org.id, conversation_id: conversationId, role, content, provider: typeof body?.provider === "string" ? body.provider : null, model: typeof body?.model === "string" ? body.model : null, steps: Array.isArray(body?.steps) ? body.steps : [] }).select("id,role,content,provider,model,steps,created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: updateError } = await db.from("ai_operator_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("org_id", org.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ message: data });
  }

  if (action === "update") {
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const patch: Record<string, unknown> = {};
    if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 80);
    if (typeof body?.archived === "boolean") patch.archived = body.archived;
    if (!conversationId || !Object.keys(patch).length) return NextResponse.json({ error: "invalid update" }, { status: 400 });
    const { data, error } = await db.from("ai_operator_conversations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", conversationId).eq("org_id", org.id).select("id,title,archived,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversation: data });
  }

  if (action === "delete") {
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    if (!conversationId) return NextResponse.json({ error: "invalid conversation" }, { status: 400 });
    const { error } = await db.from("ai_operator_conversations").delete().eq("id", conversationId).eq("org_id", org.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
