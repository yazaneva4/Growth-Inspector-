"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  email_subject?: string | null;
  thread_key?: string | null;
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
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [composer, setComposer] = useState("");
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [subject, setSubject] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  useEffect(() => setConversations(initialConversations), [initialConversations]);
  useEffect(() => setMessages(initialMessages), [initialMessages, selectedId]);

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
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setNotice("Enter a valid customer email."); return; }
    if (!subject.trim()) { setNotice("Add an email subject."); return; }
    if (!composer.trim()) { setNotice("Write the email before sending."); return; }
    setSending(true); setNotice(null);
    try {
      const res = await fetch("/api/inbox/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: target, name: newName.trim() || null, subject: subject.trim(), body: composer.trim() }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not send email");
      setEmail(""); setNewName(""); setSubject(""); setComposer(""); setShowNew(false);
      if (data?.conversation) setConversations((current) => [data.conversation, ...current.filter((c) => c.id !== data.conversation.id)]);
      if (data?.message) setMessages([data.message]);
      if (data?.conversation?.id) router.push(`/dashboard/inbox?c=${data.conversation.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send email");
    } finally { setSending(false); }
  }

  const list = (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between px-2 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversations</div>
        <div className="text-xs text-slate-400">{conversations.length}</div>
      </div>
      {conversations.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No customer emails yet.</p> : <div className="max-h-[calc(100vh-260px)] space-y-1 overflow-auto">{conversations.map((c) => {
        const active = c.id === selectedId;
        return <Link key={c.id} href={`/dashboard/inbox?c=${c.id}`} className={`block rounded-xl p-3 transition ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{c.title ?? c.customer_name ?? c.customer_email ?? c.customer_handle}</span><span className="shrink-0 text-[10px] text-slate-500">{timeAgo(c.last_message_at)}</span></div>
          <div className="mt-1 truncate text-xs text-slate-500">{c.customer_email ?? c.customer_handle}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{c.platform === "email" && <span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">EMAIL</span>}{c.urgency === "high" && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">urgent</span>}{c.assigned_to && <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500">assigned</span>}</div>
        </Link>;
      })}</div>}
    </div>
  );

  const thread = selected ? (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 p-4 sm:p-5">
        <Link href="/dashboard/inbox" className="lg:hidden rounded-lg border border-slate-200 px-2.5 py-2 text-sm">←</Link>
        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{selected.customer_name ?? selected.customer_email ?? selected.customer_handle}</div><div className="mt-1 truncate text-xs text-slate-500">{selected.customer_email ?? selected.customer_handle}</div><div className="mt-2 text-xs text-slate-400">{selected.email_subject ?? selected.title ?? "Email conversation"}</div></div>
        <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-700">{selected.status}</span>
      </div>
      <div className="max-h-[calc(100vh-340px)] min-h-[320px] space-y-3 overflow-y-auto p-4 sm:p-5">
        {messages.map((m) => { const inbound = m.direction === "inbound"; const ai = m.author === "ai"; return <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}><div className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${ai ? "border border-violet-200 bg-violet-50" : inbound ? "bg-slate-100" : "bg-emerald-500 text-white"}`}><div className="whitespace-pre-wrap break-words" dir="auto">{m.body}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px] opacity-60"><span>{ai ? "Growth AI" : inbound ? "Customer" : "You"}</span><span>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{!inbound && !ai && <span>{m.delivery_status}</span>}</div></div></div>; })}
        {messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">No messages yet.</p>}
      </div>
      <div className="border-t border-slate-200 p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={composer} onChange={(e) => setComposer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Write an email reply…" className="min-h-12 max-h-40 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" /><button disabled={sending || !composer.trim()} onClick={() => void sendMessage()} className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">{sending ? "…" : "Send"}</button></div><div className="mt-2 text-[10px] text-slate-500">Enter sends · Shift+Enter adds a new line · delivered to the customer's email address</div></div>
    </div>
  ) : (
    <div className="hidden min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center lg:flex"><div><div className="text-4xl">✉️</div><p className="mt-3 font-medium">Select an email</p><p className="mt-1 text-sm text-slate-500">Choose a conversation or compose a new customer email.</p></div></div>
  );

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><h1 className="text-2xl font-bold">Inbox</h1><p className="mt-1 text-sm text-slate-500">Customer email conversations · live updates · human + AI activity</p></div>
        <div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">● Live</span>{!isDemo && <button onClick={() => { setNotice(null); setShowNew(true); }} className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white">+ Compose email</button>}</div>
      </div>

      {notice && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>}

      {showNew && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Compose email</h2><p className="mt-1 text-xs text-slate-500">Send directly to the customer's Gmail, Yahoo, Outlook, or other email address.</p></div><button onClick={() => setShowNew(false)} className="rounded-lg px-2 py-1 text-slate-500">✕</button></div>
          <div className="mt-5 grid gap-3"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="To: customer@example.com" type="email" autoFocus className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" /><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name (optional)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" /><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" /><textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Write your email…" className="min-h-44 resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" /></div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setShowNew(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium">Cancel</button><button disabled={sending} onClick={() => void startConversation()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? "Sending email…" : "Send email"}</button></div>
        </div>
      </div>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={selectedId ? "hidden lg:block" : "block"}>{list}</div>
        <div className={selectedId ? "block" : "hidden lg:block"}>{thread}</div>
      </div>
    </div>
  );
}
