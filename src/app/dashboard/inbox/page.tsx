import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { AssignControl } from "@/components/assign-control";

export const dynamic = "force-dynamic";

const platformBadge: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: "WA", cls: "bg-green-500/20 text-green-700" },
  instagram: { label: "IG", cls: "bg-pink-500/20 text-pink-700" },
  x: { label: "X", cls: "bg-slate-500/20 text-slate-800" },
  snapchat: { label: "SC", cls: "bg-yellow-500/20 text-yellow-700" },
  tiktok: { label: "TT", cls: "bg-cyan-500/20 text-cyan-700" },
  email: { label: "@", cls: "bg-sky-500/20 text-sky-700" },
  call: { label: "📞", cls: "bg-violet-500/20 text-violet-700" },
  sandbox: { label: "•", cls: "bg-slate-500/20 text-slate-600" },
};

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

type ConversationRow = {
  id: string;
  customer_name: string | null;
  customer_handle: string;
  platform: string;
  intent: string | null;
  status: string;
  lead_score: number | null;
  last_message_at: string;
  title: string | null;
  urgency: string | null;
  assigned_to: string | null;
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db.from("organizations").select("id").eq("slug", ctx.orgSlug).maybeSingle();
  const CONV_COLUMNS = "id, customer_name, customer_handle, platform, intent, status, lead_score, last_message_at, title, urgency, assigned_to";

  const [conversationsRes, teammatesRes, contactsRes] = await Promise.all([
    org ? db.from("conversations").select(CONV_COLUMNS).eq("org_id", org.id).order("last_message_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as ConversationRow[] }),
    ctx.isDemo ? Promise.resolve({ data: [] as { user_id: string; email: string; role: string }[] }) : db.rpc("org_teammates"),
    org ? db.from("backup_contacts").select("id, name, phone").eq("org_id", org.id).order("created_at") : Promise.resolve({ data: [] as { id: string; name: string; phone: string }[] }),
  ]);

  const conversations: ConversationRow[] = conversationsRes.data ?? [];
  const teammates = ((teammatesRes.data ?? []) as { user_id: string; email: string; role: string }[]).map((t) => ({ user_id: t.user_id, email: t.email }));
  const contacts: Array<{ id: string; name: string; phone: string }> = contactsRes.data ?? [];
  const selectedId = sp.c;

  let selected = conversations.find((c) => c.id === selectedId) ?? null;
  let messages: Array<{ id: string; author: string; direction: string; body: string; ai_confidence: number | null; created_at: string }> = [];
  if (selectedId && org) {
    const [messagesRes, selectedRes] = await Promise.all([
      db.from("messages").select("id, author, direction, body, ai_confidence, created_at").eq("conversation_id", selectedId).order("created_at", { ascending: true }),
      selected ? Promise.resolve({ data: null }) : db.from("conversations").select(CONV_COLUMNS).eq("id", selectedId).maybeSingle(),
    ]);
    messages = messagesRes.data ?? [];
    if (!selected) selected = (selectedRes.data as ConversationRow | null) ?? null;
  }

  const aiMessageCount = messages.filter((m) => m.author === "ai").length;
  const humanMessageCount = messages.length - aiMessageCount;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ctx.name ? `Welcome back, ${ctx.name} 👋` : "Inbox"}</h1>
          <p className="mt-1 text-sm text-slate-500">{conversations.length} conversation{conversations.length === 1 ? "" : "s"} · customer chat + AI monitoring</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700">● Chat live</span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-medium text-violet-700">✦ AI monitored</span>
        </div>
      </div>

      <div className={`mt-5 grid gap-4 ${contacts.length > 0 ? "lg:grid-cols-[320px_1fr_220px]" : "lg:grid-cols-[320px_1fr]"}`}>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2">
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No customer conversations yet.</p>
          ) : (
            <div className="max-h-[70vh] space-y-1 overflow-auto">
              {conversations.map((c) => {
                const badge = platformBadge[c.platform] ?? platformBadge.sandbox;
                const active = c.id === selectedId;
                return (
                  <Link key={c.id} href={`/dashboard/inbox?c=${c.id}`} className={`block rounded-xl p-3 ${active ? "bg-slate-100" : "hover:bg-slate-100"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                        <span className="truncate text-sm font-medium" dir="auto">{c.title ?? c.customer_name ?? c.customer_handle}</span>
                        {c.urgency === "high" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" title="High urgency" />}
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500" dir="auto">{c.customer_name ?? c.customer_handle}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {c.intent && <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500">{c.intent}</span>}
                      {c.status === "escalated" && <span className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-600">escalated</span>}
                      {(c.lead_score ?? 0) >= 80 && <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-500">hot lead</span>}
                      {!ctx.isDemo && <span className={`rounded border px-1.5 py-0.5 text-[10px] ${c.assigned_to ? (c.assigned_to === ctx.userId ? "border-emerald-500/40 text-emerald-600" : "border-slate-300 text-slate-500") : "border-amber-500/40 text-amber-700"}`}>{c.assigned_to ? (c.assigned_to === ctx.userId ? "you" : "assigned") : "unassigned"}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          {selected ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="font-semibold" dir="auto">{selected.title ?? selected.customer_name ?? selected.customer_handle}</div>
                  <div className="mt-0.5 text-xs text-slate-500" dir="auto">{selected.customer_name ?? selected.customer_handle} · {selected.platform}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600">Human chat: {humanMessageCount}</span>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-700">AI activity: {aiMessageCount}</span>
                  {selected.status === "escalated" && <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-xs text-rose-600">escalated</span>}
                  {!ctx.isDemo && ctx.userId && <AssignControl conversationId={selected.id} assignedTo={selected.assigned_to} currentUserId={ctx.userId} teammates={teammates} />}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {messages.map((m) => {
                  const inbound = m.direction === "inbound";
                  const isAi = m.author === "ai";
                  return (
                    <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isAi ? "border border-violet-500/20 bg-violet-50 text-slate-900" : inbound ? "bg-slate-100 text-slate-900" : "bg-emerald-500 text-slate-950"}`} dir="auto">
                        {m.body}
                        <div className="mt-1 text-[10px] opacity-60">{isAi ? `AI${m.ai_confidence != null ? ` · ${(m.ai_confidence * 100).toFixed(0)}% confidence` : ""}` : inbound ? "Customer" : "Human team"}</div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="text-sm text-slate-500">No messages.</p>}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">💬</div>
              <p className="text-sm font-medium text-slate-700">Customer chat + AI monitor</p>
              <p className="mt-1 text-sm text-slate-500">Select a conversation to see the human messages and AI activity together.</p>
            </div>
          )}
        </div>

        {contacts.length > 0 && (
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Need help? Call</h2>
            <div className="mt-3 space-y-3">
              {contacts.map((c) => <a key={c.id} href={`tel:${c.phone.replace(/\s/g, "")}`} className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><div className="text-sm font-medium" dir="auto">{c.name}</div><div className="mt-0.5 text-xs text-slate-500">{c.phone}</div></a>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
