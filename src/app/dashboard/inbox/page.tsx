import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { InboxSimulator } from "@/components/inbox-simulator";

export const dynamic = "force-dynamic";

const platformBadge: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: "WA", cls: "bg-green-500/20 text-green-300" },
  instagram: { label: "IG", cls: "bg-pink-500/20 text-pink-300" },
  x: { label: "X", cls: "bg-slate-500/20 text-slate-200" },
  snapchat: { label: "SC", cls: "bg-yellow-500/20 text-yellow-300" },
  tiktok: { label: "TT", cls: "bg-cyan-500/20 text-cyan-300" },
  email: { label: "@", cls: "bg-sky-500/20 text-sky-300" },
  sandbox: { label: "•", cls: "bg-slate-500/20 text-slate-300" },
};

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; test?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  let conversations: Array<{
    id: string;
    customer_name: string | null;
    customer_handle: string;
    platform: string;
    intent: string | null;
    status: string;
    lead_score: number | null;
    last_message_at: string;
  }> = [];
  if (org) {
    const { data } = await db
      .from("conversations")
      .select("id, customer_name, customer_handle, platform, intent, status, lead_score, last_message_at")
      .eq("org_id", org.id)
      .order("last_message_at", { ascending: false })
      .limit(50);
    conversations = data ?? [];
  }

  const selectedId = sp.c;
  const showTester = sp.test === "1" || (!selectedId && conversations.length === 0);

  let messages: Array<{
    id: string;
    author: string;
    direction: string;
    body: string;
    ai_confidence: number | null;
    created_at: string;
  }> = [];
  let selected = conversations.find((c) => c.id === selectedId) ?? null;
  if (selectedId && org) {
    const { data } = await db
      .from("messages")
      .select("id, author, direction, body, ai_confidence, created_at")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true });
    messages = data ?? [];
    if (!selected) {
      const { data: c } = await db
        .from("conversations")
        .select("id, customer_name, customer_handle, platform, intent, status, lead_score, last_message_at")
        .eq("id", selectedId)
        .maybeSingle();
      selected = c ?? null;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-slate-400">
            {conversations.length} conversation{conversations.length === 1 ? "" : "s"} · updates live
          </p>
        </div>
        <Link
          href={showTester ? "/dashboard/inbox" : "/dashboard/inbox?test=1"}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          {showTester ? "← Back to inbox" : "✨ Test the AI"}
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-2">
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No conversations yet. Use “Test the AI” to create some.
            </p>
          ) : (
            <div className="max-h-[70vh] space-y-1 overflow-auto">
              {conversations.map((c) => {
                const badge = platformBadge[c.platform] ?? platformBadge.sandbox;
                const active = c.id === selectedId;
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/inbox?c=${c.id}`}
                    className={`block rounded-xl p-3 ${
                      active ? "bg-slate-800" : "hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="truncate text-sm font-medium" dir="auto">
                          {c.customer_name ?? c.customer_handle}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {c.intent && (
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {c.intent}
                        </span>
                      )}
                      {c.status === "escalated" && (
                        <span className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-300">
                          escalated
                        </span>
                      )}
                      {(c.lead_score ?? 0) >= 80 && (
                        <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          hot lead
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right pane: tester, thread, or empty */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {showTester ? (
            <InboxSimulator />
          ) : selected ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="font-semibold" dir="auto">
                  {selected.customer_name ?? selected.customer_handle}
                  <span className="ml-2 text-xs text-slate-500">
                    {selected.platform}
                  </span>
                </div>
                {selected.status === "escalated" && (
                  <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-xs text-rose-300">
                    escalated
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {messages.map((m) => {
                  const inbound = m.direction === "inbound";
                  return (
                    <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          inbound ? "bg-slate-800 text-slate-100" : "bg-emerald-500 text-slate-950"
                        }`}
                        dir="auto"
                      >
                        {m.body}
                        {m.author === "ai" && m.ai_confidence != null && (
                          <div className="mt-1 text-[10px] opacity-70">
                            AI · {(m.ai_confidence * 100).toFixed(0)}% confidence
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="text-sm text-slate-500">No messages.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              Select a conversation, or hit “Test the AI”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
