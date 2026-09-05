import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { InboxRealtime } from "@/components/inbox-realtime";

export const dynamic = "force-dynamic";

type Conversation = {
  id: string;
  customer_name: string | null;
  customer_handle: string;
  customer_email: string | null;
  platform: string;
  intent: string | null;
  status: string;
  lead_score: number | null;
  last_message_at: string;
  title: string | null;
  urgency: string | null;
  assigned_to: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  author: string;
  direction: string;
  body: string;
  ai_confidence: number | null;
  created_at: string;
  delivered: boolean;
  delivery_status: string;
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  const orgId = org?.id ?? null;
  const columns = "id, customer_name, customer_handle, customer_email, platform, intent, status, lead_score, last_message_at, title, urgency, assigned_to";
  const { data: conversationRows } = orgId
    ? await db.from("conversations").select(columns).eq("org_id", orgId).order("last_message_at", { ascending: false }).limit(100)
    : { data: [] };
  const conversations = (conversationRows ?? []) as Conversation[];
  const selectedId = sp.c;
  const selectedExists = conversations.some((c) => c.id === selectedId);
  const { data: messageRows } = selectedId && orgId
    ? await db.from("messages").select("id, conversation_id, author, direction, body, ai_confidence, created_at, delivered, delivery_status").eq("conversation_id", selectedId).order("created_at", { ascending: true })
    : { data: [] };
  const messages = (messageRows ?? []) as Message[];

  return <InboxRealtime
    initialConversations={conversations}
    initialMessages={messages}
    selectedId={selectedExists ? selectedId : undefined}
    orgId={orgId}
    currentUserId={ctx.userId}
    currentUserEmail={ctx.email}
    isDemo={ctx.isDemo}
  />;
}
