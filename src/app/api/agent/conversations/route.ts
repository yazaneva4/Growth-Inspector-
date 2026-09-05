import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function getDbAndOrg() {
  const ctx = await getCurrentContext();
  if (ctx.isDemo || !ctx.userId) return null;
  const db = await createClient();
  const { data: org } = await db.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  return { db, org };
}

function titleFromMessage(content: string) {
  const value = content.replace(/\s+/g, " ").trim();
  return value.length > 60 ? `${value.slice(0, 60)}…` : value || "New conversation";
}

export async function GET() {
  const context = await getDbAndOrg();
  if (!context) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { db, org } = context;
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });

  // Do not embed ai_operator_messages here. The database can contain more
  // than one relationship between these tables (for example through tenant
  // keys), which makes PostgREST reject the embed as ambiguous. Fetch the two
  // tables independently and join them by conversation_id in application code.
  const { data: conversations, error: conversationsError } = await db
    .from("ai_operator_conversations")
    .select("id,title,archived,created_at,updated_at")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false });
  if (conversationsError) return NextResponse.json({ error: conversationsError.message }, { status: 500 });

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  let messages: Array<{ id: string; conversation_id: string; role: "user" | "assistant"; content: string; provider: string | null; model: string | null; steps: unknown; created_at: string }> = [];

  if (conversationIds.length) {
    const { data, error } = await db
      .from("ai_operator_messages")
      .select("id,conversation_id,role,content,provider,model,steps,created_at")
      .eq("org_id", org.id)
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    messages = (data ?? []) as typeof messages;
  }

  const byConversation = new Map<string, typeof messages>();
  for (const message of messages) {
    const existing = byConversation.get(message.conversation_id);
    if (existing) existing.push(message);
    else byConversation.set(message.conversation_id, [message]);
  }

  const result = (conversations ?? []).map((conversation) => ({
    ...conversation,
    ai_operator_messages: byConversation.get(conversation.id) ?? [],
  }));

  return NextResponse.json({ conversations: result }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const context = await getDbAndOrg();
  if (!context) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { db, org } = context;
  if (!org) return NextResponse.json({ error: "no workspace found" }, { status: 404 });
  const body = await req.json().catch(() => null);
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
    const { data: conversation } = await db.from("ai_operator_conversations").select("id,title").eq("id", conversationId).eq("org_id", org.id).maybeSingle();
    if (!conversation) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    const { data, error } = await db.from("ai_operator_messages").insert({ org_id: org.id, conversation_id: conversationId, role, content, provider: typeof body?.provider === "string" ? body.provider : null, model: typeof body?.model === "string" ? body.model : null, steps: Array.isArray(body?.steps) ? body.steps : [] }).select("id,role,content,provider,model,steps,created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role === "user" && (!conversation.title || conversation.title === "New conversation")) patch.title = titleFromMessage(content);
    const { error: updateError } = await db.from("ai_operator_conversations").update(patch).eq("id", conversationId).eq("org_id", org.id);
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

    // Delete child messages explicitly first. This keeps Delete reliable even
    // if the production database was created with an older FK definition.
    const { error: messagesError } = await db
      .from("ai_operator_messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("org_id", org.id);
    if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

    const { data: deleted, error } = await db
      .from("ai_operator_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("org_id", org.id)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!deleted) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    return NextResponse.json({ ok: true, deletedId: conversationId });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
