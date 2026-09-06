import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const [{ data: conversations, error: conversationError }, { data: members, error: memberError }] =
    await Promise.all([
      supabase
        .from("chat_conversations")
        .select("id, kind, title, created_by, created_at, updated_at, chat_participants(user_id)")
        .order("updated_at", { ascending: false }),
      supabase.rpc("list_chat_members"),
    ]);

  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 400 });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });

  return NextResponse.json({ conversations: conversations ?? [], members: members ?? [], currentUserId: user.id });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as string | undefined;

  if (action === "create") {
    const kind = body?.kind === "group" ? "group" : "personal";
    const participantIds = Array.from(new Set([user.id, ...(Array.isArray(body?.participantIds) ? body.participantIds : [])])) as string[];
    if (kind === "personal" && participantIds.length !== 2) {
      return NextResponse.json({ error: "personal chat needs exactly one other member" }, { status: 400 });
    }
    if (kind === "group" && participantIds.length < 2) {
      return NextResponse.json({ error: "group chat needs at least one other member" }, { status: 400 });
    }

    const { data: memberships } = await supabase
      .from("memberships")
      .select("user_id, org_id")
      .in("user_id", participantIds);
    const allowed = new Set((memberships ?? []).map((m) => m.user_id));
    if (participantIds.some((id) => !allowed.has(id))) {
      return NextResponse.json({ error: "one or more selected users are not in your workspace" }, { status: 403 });
    }

    const orgId = memberships?.find((m) => m.user_id === user.id)?.org_id;
    if (!orgId) return NextResponse.json({ error: "no organization" }, { status: 404 });

    const directKey = kind === "personal" ? [user.id, participantIds.find((id) => id !== user.id)!].sort().join(":") : null;
    if (directKey) {
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id, kind, title, created_by, created_at, updated_at")
        .eq("direct_key", directKey)
        .maybeSingle();
      if (existing) return NextResponse.json({ conversation: existing });
    }

    const { data: conversation, error: createError } = await supabase
      .from("chat_conversations")
      .insert({
        org_id: orgId,
        kind,
        title: kind === "group" ? String(body?.title ?? "").trim().slice(0, 120) || "New group" : null,
        direct_key: directKey,
        created_by: user.id,
      })
      .select("id, kind, title, created_by, created_at, updated_at")
      .single();

    if (createError || !conversation) {
      if (directKey) {
        const { data: raced } = await supabase
          .from("chat_conversations")
          .select("id, kind, title, created_by, created_at, updated_at")
          .eq("direct_key", directKey)
          .maybeSingle();
        if (raced) return NextResponse.json({ conversation: raced });
      }
      return NextResponse.json({ error: createError?.message ?? "failed to create chat" }, { status: 400 });
    }

    const { error: participantError } = await supabase.from("chat_participants").insert(
      participantIds.map((userId) => ({ conversation_id: conversation.id, user_id: userId })),
    );
    if (participantError) {
      await supabase.from("chat_conversations").delete().eq("id", conversation.id);
      return NextResponse.json({ error: participantError.message }, { status: 400 });
    }

    return NextResponse.json({ conversation });
  }

  if (action === "message") {
    const conversationId = String(body?.conversationId ?? "");
    const text = String(body?.text ?? "").trim();
    if (!conversationId || !text) return NextResponse.json({ error: "conversation and message are required" }, { status: 400 });
    if (text.length > 4000) return NextResponse.json({ error: "message too long" }, { status: 400 });

    const { data: participant } = await supabase
      .from("chat_participants")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!participant) return NextResponse.json({ error: "not a participant" }, { status: 403 });

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .limit(1)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "no organization" }, { status: 404 });

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        org_id: membership.org_id,
        author_id: user.id,
        author_email: user.email ?? "unknown",
        body: text,
      })
      .select("id, conversation_id, author_id, author_email, body, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({ message });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
