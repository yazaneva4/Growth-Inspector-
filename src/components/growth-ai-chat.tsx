"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string; provider?: string; model?: string; createdAt: number; status?: "pending" | "failed" | "unsaved" };
type Conversation = { id: string; title: string; messages: Message[]; archived: boolean; updatedAt: number };
type ApiConversation = { id: string; title: string; archived: boolean; updated_at: string; ai_operator_messages?: Array<{ id: string; role: "user" | "assistant"; content: string; provider?: string | null; model?: string | null; created_at: string }> };

function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function titleFrom(text: string) { const value = text.replace(/\s+/g, " ").trim(); return value.length > 60 ? `${value.slice(0, 60)}…` : value || "New conversation"; }
function fromApi(value: ApiConversation): Conversation { return { id: value.id, title: value.title || "New conversation", archived: value.archived, updatedAt: Date.parse(value.updated_at) || Date.now(), messages: (value.ai_operator_messages ?? []).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).map((m) => ({ id: m.id, role: m.role, content: typeof m.content === "string" ? m.content : "", provider: m.provider ?? undefined, model: m.model ?? undefined, createdAt: Date.parse(m.created_at) || Date.now() })) }; }
function historyForModel(messages: Message[]) { const result: Array<{ role: "user" | "assistant"; content: string }> = []; let chars = 0; for (let i = messages.length - 1; i >= 0 && result.length < 64; i--) { const m = messages[i]; const content = typeof m.content === "string" ? m.content : ""; const size = content.length + 40; if (result.length && chars + size > 30000) break; result.unshift({ role: m.role, content }); chars += size; } return result; }

export function GrowthAiChat() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);

  async function refreshChats(selectFirst = false) {
    try {
      const res = await fetch("/api/agent/conversations", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not load saved conversations.");
      const next = (Array.isArray(data?.conversations) ? data.conversations : []).map((item: ApiConversation) => fromApi(item));
      if (!next.length) {
        const create = await fetch("/api/agent/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
        const created = await create.json().catch(() => null);
        if (!create.ok || !created?.conversation) throw new Error(created?.error || "Could not create a conversation.");
        const chat = fromApi({ ...created.conversation, ai_operator_messages: [] });
        setChats([chat]); activeIdRef.current = chat.id; setActiveId(chat.id); return;
      }
      setChats(next);
      const current = activeIdRef.current;
      const selected = current && next.some((c: Conversation) => c.id === current) ? current : next.find((c: Conversation) => c.archived === showArchived)?.id ?? next[0].id;
      if (selectFirst || !current || !next.some((c: Conversation) => c.id === current)) { activeIdRef.current = selected; setActiveId(selected); }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load saved conversations."); }
  }

  useEffect(() => { void refreshChats(true); }, [showArchived]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, chats, busy]);

  const active = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);
  const visible = chats.filter((c) => c.archived === showArchived && (!search.trim() || c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some((m) => String(m.content ?? "").toLowerCase().includes(search.toLowerCase()))));

  async function api(body: Record<string, unknown>) { const res = await fetch("/api/agent/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json().catch(() => null); if (!res.ok) throw new Error(data?.error || "Conversation update failed."); return data; }
  async function createChat() { try { const data = await api({ action: "create" }); const chat = fromApi({ ...data.conversation, ai_operator_messages: [] }); setChats((v) => [chat, ...v]); activeIdRef.current = chat.id; setActiveId(chat.id); setInput(""); setError(null); requestAnimationFrame(() => inputRef.current?.focus()); } catch (err) { setError(err instanceof Error ? err.message : "Could not create conversation."); } }
  async function finishRename() { if (!renameId) return; const value = renameValue.trim(); if (value) { try { await api({ action: "update", conversationId: renameId, title: value.slice(0, 80) }); await refreshChats(); } catch (err) { setError(err instanceof Error ? err.message : "Could not rename conversation."); } } setRenameId(null); setRenameValue(""); }
  async function archiveChat(id: string, archived: boolean) { try { await api({ action: "update", conversationId: id, archived }); await refreshChats(); if (archived && id === activeId) await createChat(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update conversation."); } }
  async function deleteChat(id: string) { try { await api({ action: "delete", conversationId: id }); await refreshChats(true); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete conversation."); } }

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    let current = active;
    if (!current) {
      try { const created = await api({ action: "create" }); if (!created?.conversation?.id) throw new Error("Could not create a conversation."); current = fromApi({ ...created.conversation, ai_operator_messages: [] }); activeIdRef.current = current.id; setActiveId(current.id); setChats((all) => [current!, ...all.filter((c) => c.id !== current!.id)]); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not start a conversation."); return; }
    }
    const pendingId = makeId();
    const pendingUser: Message = { id: pendingId, role: "user", content: value, createdAt: Date.now(), status: "pending" };
    const history = historyForModel([...current.messages, pendingUser]);
    setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: [...c.messages, pendingUser], title: c.messages.length ? c.title : titleFrom(value), updatedAt: Date.now(), archived: false } : c));
    setInput(""); setBusy(true); setError(null);
    try {
      await api({ action: "message", conversationId: current.id, role: "user", content: value });
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: value, provider: "auto", model: "auto", history }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Growth AI could not answer.");
      const answer = typeof data?.answer === "string" ? data.answer : "No answer returned.";
      const assistant: Message = { id: makeId(), role: "assistant", content: answer, provider: data?.provider, model: data?.model, createdAt: Date.now() };
      await api({ action: "message", conversationId: current.id, role: "assistant", content: answer, provider: data?.provider, model: data?.model, steps: Array.isArray(data?.steps) ? data.steps : [] });
      setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: [...c.messages.map((m) => m.id === pendingId ? { ...m, status: undefined } : m), assistant] } : c));
      await refreshChats();
    } catch (err) {
      setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: c.messages.map((m) => m.id === pendingId ? { ...m, status: "failed" } : m) } : c));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }

  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void send(input); }

  return <section className="flex min-h-[70vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <aside className="hidden w-80 shrink-0 border-r border-slate-200 md:flex md:flex-col">
      <div className="border-b border-slate-200 p-3">
        <div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"/><button onClick={() => void createChat()} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white">+</button></div>
        <div className="mt-2 flex gap-1"><button onClick={() => setShowArchived(false)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!showArchived ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>Chats</button><button onClick={() => setShowArchived(true)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${showArchived ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>Archived</button></div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{visible.map((chat) => <button key={chat.id} onClick={() => setActiveId(chat.id)} className={`mb-1 w-full rounded-xl p-3 text-left ${chat.id === activeId ? "bg-emerald-50" : "hover:bg-slate-50"}`}><div className="truncate text-sm font-semibold text-slate-900">{chat.title}</div><div className="truncate text-xs text-slate-400">{chat.messages.at(-1)?.content || "New conversation"}</div></button>)}{!visible.length && <p className="p-5 text-center text-sm text-slate-500">No conversations here.</p>}</div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><div className="flex-1"><h2 className="font-semibold text-slate-900">Growth AI</h2><p className="text-xs text-slate-400">Free AI routing is automatic. No model selection.</p></div>{active && <><button onClick={() => { setRenameId(active.id); setRenameValue(active.title); }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">Rename</button><button onClick={() => void archiveChat(active.id, !active.archived)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">{active.archived ? "Restore" : "Archive"}</button><button onClick={() => void deleteChat(active.id)} className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600">Delete</button></>}</header>
      <div className="flex-1 overflow-y-auto p-4">{!active ? <div className="flex h-full items-center justify-center text-sm text-slate-500">Start a new conversation.</div> : active.messages.map((m) => <div key={m.id} className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900"}`} dir="auto">{m.content}{m.status === "pending" ? " …" : m.status === "failed" ? "\nMessage failed." : ""}</div></div>)}<div ref={endRef}/></div>
      <form onSubmit={submit} className="border-t border-slate-200 p-3"><div className="flex gap-2"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} rows={1} placeholder="Ask Growth AI anything…" className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500" dir="auto"/><button disabled={busy || !input.trim()} className="self-end rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : "Send"}</button></div><p className="mt-1 text-[10px] text-slate-400">Enter sends · Shift+Enter makes a new line</p></form>
    </main>
    {renameId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h3 className="font-semibold">Rename conversation</h3><input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void finishRename(); }} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/><div className="mt-3 flex justify-end gap-2"><button onClick={() => setRenameId(null)} className="rounded-lg px-3 py-2 text-sm">Cancel</button><button onClick={() => void finishRename()} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">Save</button></div></div></div>}
    {error && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-lg">{error}</div>}
  </section>;
}
