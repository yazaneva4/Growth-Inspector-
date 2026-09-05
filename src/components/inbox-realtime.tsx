"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function InboxRealtime({
  initialConversations,
  initialMessages,
  selectedId,
  orgId,
  currentUserId,
  currentUserEmail,
  isDemo,
}: {
  initialConversations: Conversation[];
  initialMessages: Message[];
  selectedId: string | undefined;
  orgId: string | null;
  currentUserId: string | null;
  currentUserEmail: string | null;
  isDemo: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [composer, setComposer] = useState("");
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [subject, setSubject] = useState("Your Growth Inspector conversation");
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, selectedId]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`growth-inbox-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `org_id=eq.${orgId}` }, (payload) => {
        const row = (payload.new || payload.old) as Conversation;
        if (!row?.id) return;
        setConversations((current) => {
          if (payload.eventType === "DELETE") return current.filter((c) => c.id !== row.id);
          const next = current.some((c) => c.id === row.id) ? current.map((c) => c.id === row.id ? { ...c, ...row } : c) : [row, ...current];
          return next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()).slice(0, 100);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` }, (payload) => {
        const row = (payload.new || payload.old) as Message;
        if (!row?.id || row.conversation_id !== selectedId) return;
        if (payload.eventType === "DELETE") setMessages((current) => current.filter((m) => m.id !== row.id));
        else setMessages((current) => current.some((m) => m.id === row.id) ? current.map((m) => m.id === row.id ? { ...m, ...row } : m) : [...current, row]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId, selectedId]);

  async function sendMessage() {
    const body = composer.trim();
    if (!body || !selected || sending) return;
    setSending(true); setNotice(null);
    try {
      const res = await fetch("/api/inbox/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id, body }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not send message");
      setComposer("");
      if (data?.message) setMessages((current) => current.some((m: Message) => m.id === data.message.id) ? current : [...current, data.message]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send message");
    } finally { setSending(false); }
  }

  async function startConversation() {
    const target = email.trim().toLowerCase();
    if (!target || !target.includes("@")) { setNotice("Enter a valid customer email."); return; }
    setSending(true); setNotice(null);
    try {
      const res = await fetch("/api/inbox/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: target, name: newName.trim() || null, subject: subject.trim() || null }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not create conversation");
      setEmail(""); setNewName(""); setShowNew(false);
      if (data?.conversation) {
        setConversations((current) => [data.conversation, ...current.filter((c) => c.id !== data.conversation.id)]);
        window.history.replaceState(null, "", `/dashboard/inbox?c=${data.conversation.id}`);
        window.location.reload();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create conversation");
    } finally { setSending(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{currentUserEmail ? "Inbox" : "Customer Inbox"}</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time conversations · email identity · human + AI activity</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700">● Live</span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-medium text-violet-700">✦ AI monitored</span>
          {!isDemo && <button onClick={() => setShowNew(true)} className="rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white">+ Email customer</button>}
        </div>
      </div>

      {notice && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>}

      {showNew && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Start a customer conversation</h2><p className="text-xs text-slate-500">The customer only needs their email. No Growth Inspector account is required.</p></div><button onClick={() => setShowNew(false)} className="text-slate-500">✕</button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" type="email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name (optional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button disabled={sending} onClick={startConversation} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{sending ? "Starting…" : "Join customer"}</button>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2">
          {conversations.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No customer conversations yet.</p> : <div className="max-h-[72vh] space-y-1 overflow-auto">{conversations.map((c) => {
            const active = c.id === selectedId;
            return <Link key={c.id} href={`/dashboard/inbox?c=${c.id}`} className={`block rounded-xl p-3 ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{c.title ?? c.customer_name ?? c.customer_email ?? c.customer_handle}</span><span className="shrink-0 text-[10px] text-slate-500">{timeAgo(c.last_message_at)}</span></div>
              <div className="mt-1 truncate text-xs text-slate-500">{c.customer_email ?? c.customer_handle}</div>
              <div className="mt-2 flex gap-1.5">{c.platform === "email" && <span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">EMAIL</span>}{c.urgency === "high" && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">urgent</span>}{c.assigned_to && <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500">assigned</span>}</div>
            </Link>;
          })}</div>}
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {selected ? <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
              <div><div className="font-semibold">{selected.customer_name ?? selected.customer_email ?? selected.customer_handle}</div><div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500"><span>{selected.customer_email ?? selected.customer_handle}</span><span>·</span><span>{selected.platform}</span>{selected.assigned_to && <><span>·</span><span>{selected.assigned_to === currentUserId ? "You joined" : "Team member joined"}</span></>}</div></div>
              <div className="flex items-center gap-2"><span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-700">{selected.status}</span></div>
            </div>
            <div className="max-h-[52vh] min-h-[360px] space-y-3 overflow-auto p-5">
              {messages.map((m) => { const inbound = m.direction === "inbound"; const ai = m.author === "ai"; return <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${ai ? "border border-violet-200 bg-violet-50" : inbound ? "bg-slate-100" : "bg-emerald-500"}`}><div className="whitespace-pre-wrap" dir="auto">{m.body}</div><div className="mt-1 flex gap-2 text-[10px] opacity-60"><span>{ai ? "Growth AI" : inbound ? "Customer" : "Human team"}</span><span>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{!inbound && !ai && <span>{m.delivery_status}</span>}</div></div></div>; })}
              {messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">No messages yet. Send the first message to this customer.</p>}
            </div>
            <div className="border-t border-slate-200 p-4"><div className="flex gap-2"><textarea value={composer} onChange={(e) => setComposer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder={selected.platform === "email" ? "Write an email reply…" : "Write a message…"} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" /><button disabled={sending || !composer.trim()} onClick={() => void sendMessage()} className="self-end rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">{sending ? "Sending…" : "Send"}</button></div><div className="mt-2 text-[10px] text-slate-500">Replies are stored in this thread and, for email conversations, sent to the customer’s email inbox.</div></div>
          </> : <div className="py-20 text-center"><div className="text-4xl">💬</div><p className="mt-3 font-medium">Select a customer</p><p className="mt-1 text-sm text-slate-500">Every new message appears here in real time.</p></div>}
        </div>
      </div>
    </div>
  );
}
