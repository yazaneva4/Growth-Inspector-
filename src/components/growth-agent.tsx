"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface AgentStep { tool: string; args: Record<string, unknown>; result: unknown; }
type Provider = "openai" | "anthropic" | "zai" | "gemini";
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; steps?: AgentStep[]; provider?: Provider; model?: string; createdAt: number };
type Conversation = { id: string; title: string; messages: ChatMessage[]; createdAt: number; updatedAt: number; archived?: boolean };
type Model = { id: string; name: string };
type ProviderState = { configured: boolean; models: Model[] };
type Providers = Record<Provider, ProviderState>;

const STORAGE_KEY = "growth-inspector-operator-conversations-v4";
const MODEL_KEY = "growth-inspector-operator-model-v1";
const MAX_CONVERSATIONS = 50;
const providerNames: Record<Provider, string> = { openai: "GPT / OpenAI", anthropic: "Anthropic / Claude", zai: "z.ai / GLM", gemini: "Google / Gemini" };
const toolLabel: Record<string, string> = { get_analytics_summary: "Analytics", get_competitors: "Competitors", get_trend_radar: "Trend radar", send_email: "Email", send_whatsapp: "WhatsApp" };
const starters = ["How are we doing this week?", "What are our biggest growth opportunities?", "Check the latest trend radar.", "What should I focus on today?"];

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function makeConversation(): Conversation { const now = Date.now(); return { id: makeId(), title: "New conversation", messages: [], createdAt: now, updatedAt: now, archived: false }; }
function titleFrom(text: string) { const clean = text.replace(/\s+/g, " ").trim(); return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New conversation"; }
function loadConversations(): Conversation[] { if (typeof window === "undefined") return []; try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown; return Array.isArray(parsed) ? parsed.filter((v): v is Conversation => Boolean(v && typeof v === "object" && typeof (v as Conversation).id === "string" && typeof (v as Conversation).title === "string" && Array.isArray((v as Conversation).messages))) : []; } catch { return []; } }
function saveConversations(value: Conversation[]) { if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify([...value].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS))); }

export function GrowthAgent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Providers>({ openai: { configured: false, models: [] }, anthropic: { configured: false, models: [] }, zai: { configured: false, models: [] }, gemini: { configured: false, models: [] } });
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshProviders = async () => {
    try { const res = await fetch("/api/agent", { cache: "no-store" }); const data = await res.json(); if (data?.providers) setProviders(data.providers as Providers); } catch {}
  };

  useEffect(() => {
    const stored = loadConversations(); const initial = stored.length ? stored : [makeConversation()]; setConversations(initial); setActiveId(initial[0].id);
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved?.includes(":")) { const [p, ...parts] = saved.split(":"); if (["openai", "anthropic", "zai", "gemini"].includes(p)) { setProvider(p as Provider); setModel(parts.join(":")); } }
    void refreshProviders();
  }, []);
  useEffect(() => { if (conversations.length) saveConversations(conversations); }, [conversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, conversations, busy]);
  useEffect(() => {
    const models = providers[provider].models; if (!models.length) return;
    if (!models.some((m) => m.id === model)) { const first = models.find((m) => !unavailable[`${provider}:${m.id}`]) ?? models[0]; setModel(first.id); }
  }, [provider, providers, model, unavailable]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [activeId, conversations]);
  const visible = useMemo(() => { const needle = search.trim().toLowerCase(); return conversations.filter((c) => Boolean(c.archived) === showArchived && (!needle || c.title.toLowerCase().includes(needle) || c.messages.some((m) => m.content.toLowerCase().includes(needle)))); }, [conversations, search, showArchived]);
  const selectedKey = `${provider}:${model}`;
  const selectedUnavailable = Boolean(unavailable[selectedKey]);

  function updateConversation(id: string, patch: Partial<Conversation>) { setConversations((current) => current.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c).sort((a, b) => b.updatedAt - a.updatedAt)); }
  function updateActiveMessages(messages: ChatMessage[]) { if (!active) return; updateConversation(active.id, { messages, archived: false, title: active.messages.length === 0 && messages[0]?.role === "user" ? titleFrom(messages[0].content) : active.title }); }
  function newChat() { const next = makeConversation(); setConversations((current) => [next, ...current].slice(0, MAX_CONVERSATIONS)); setActiveId(next.id); setInput(""); setError(null); setShowArchived(false); setSidebarOpen(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  function archiveConversation(id: string) { updateConversation(id, { archived: true }); if (id === activeId) { const next = conversations.find((c) => c.id !== id && !c.archived); if (next) setActiveId(next.id); else newChat(); } }
  function restoreConversation(id: string) { updateConversation(id, { archived: false }); setShowArchived(false); setActiveId(id); }
  function deleteConversation(id: string) { const remaining = conversations.filter((c) => c.id !== id); const next = remaining.length ? remaining : [makeConversation()]; setConversations(next); if (id === activeId) setActiveId(next[0].id); }
  function beginRename(c: Conversation) { setRenamingId(c.id); setRenameValue(c.title); }
  function finishRename() { if (!renamingId) return; const clean = renameValue.trim(); if (clean) updateConversation(renamingId, { title: clean.slice(0, 80) }); setRenamingId(null); setRenameValue(""); }
  function chooseModel(nextProvider: Provider, nextModel: string) { if (!providers[nextProvider].configured || unavailable[`${nextProvider}:${nextModel}`]) return; setProvider(nextProvider); setModel(nextModel); localStorage.setItem(MODEL_KEY, `${nextProvider}:${nextModel}`); setError(null); }

  async function sendMessage(text: string) {
    const trimmed = text.trim(); if (!trimmed || busy || !active || !providers[provider].configured || selectedUnavailable || !model) return;
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: trimmed, createdAt: Date.now() }; const history = [...active.messages, userMessage]; updateActiveMessages(history); setInput(""); setBusy(true); setError(null);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: trimmed, provider, model, history: active.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })) }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { if (data?.temporaryUnavailable) { const key = `${data.provider ?? provider}:${data.model ?? model}`; setUnavailable((u) => ({ ...u, [key]: true })); setError(`${providerNames[data.provider as Provider] ?? providerNames[provider]} · ${data.model ?? model} is temporarily unavailable because its quota or rate limit was reached.`); } else throw new Error(data?.error ?? "Growth Operator could not answer right now."); return; }
      const assistant: ChatMessage = { id: makeId(), role: "assistant", content: data?.answer ?? "I didn't get an answer back.", steps: Array.isArray(data?.steps) ? data.steps : [], provider: data?.provider, model: data?.model, createdAt: Date.now() }; updateActiveMessages([...history, assistant]);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void sendMessage(input); }

  return (
    <section className="flex h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {sidebarOpen && <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-900">Growth Operator</p><p className="text-[11px] text-slate-500">AI conversations</p></div><button type="button" onClick={newChat} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">+ New chat</button></div>
        <div className="border-b border-slate-200 p-3"><div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div><div className="mt-2 flex gap-1 text-[11px]"><button type="button" onClick={() => setShowArchived(false)} className={`rounded-lg px-2.5 py-1.5 ${!showArchived ? "bg-emerald-500/10 font-semibold text-emerald-700" : "text-slate-500"}`}>Recent</button><button type="button" onClick={() => setShowArchived(true)} className={`rounded-lg px-2.5 py-1.5 ${showArchived ? "bg-amber-500/10 font-semibold text-amber-700" : "text-slate-500"}`}>Archived</button></div></div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">{visible.length === 0 ? <div className="px-3 py-8 text-center text-xs text-slate-400">{showArchived ? "No archived chats" : "No matching chats"}</div> : visible.map((c) => <div key={c.id} className={`group rounded-xl ${c.id === active?.id ? "bg-emerald-500/10" : "hover:bg-slate-100"}`}><button type="button" onClick={() => { setActiveId(c.id); setSidebarOpen(false); }} className="w-full px-3 py-2.5 text-left">{renamingId === c.id ? <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={finishRename} onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setRenamingId(null); }} className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs" /> : <><div className="truncate text-sm font-medium text-slate-700">{c.title}</div><div className="mt-0.5 text-[10px] text-slate-400">{c.messages.length} messages</div></>}</button><div className="flex gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100">{showArchived ? <button type="button" onClick={() => restoreConversation(c.id)} className="rounded-md px-2 py-1 text-[10px] text-emerald-600">Restore</button> : <><button type="button" onClick={() => beginRename(c)} className="rounded-md px-2 py-1 text-[10px] text-slate-500">Rename</button><button type="button" onClick={() => archiveConversation(c.id)} className="rounded-md px-2 py-1 text-[10px] text-slate-500">Archive</button></>}<button type="button" onClick={() => deleteConversation(c.id)} className="rounded-md px-2 py-1 text-[10px] text-rose-500">Delete</button></div></div>)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-3 sm:px-5"><button type="button" onClick={() => setSidebarOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 lg:hidden">☰</button><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{active?.title ?? "Growth Operator"}</h2><p className="text-[11px] text-slate-500">Your AI growth teammate</p></div><select value={selectedKey} onChange={(e) => { const [p, ...rest] = e.target.value.split(":"); chooseModel(p as Provider, rest.join(":")); }} className="max-w-[330px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700" aria-label="Choose AI model">
          {(Object.keys(providers) as Provider[]).map((p) => <optgroup key={p} label={`${providerNames[p]}${providers[p].configured ? "" : " · not configured"}`}>{providers[p].models.map((m) => { const key = `${p}:${m.id}`; const bad = unavailable[key]; return <option key={key} value={key} disabled={!providers[p].configured || Boolean(bad)}>{bad ? `${m.name} · Temporarily unavailable` : m.name}</option>; })}</optgroup>)}
        </select><button type="button" onClick={() => { setUnavailable({}); void refreshProviders(); }} title="Refresh model availability" className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs">↻</button><button type="button" onClick={newChat} className="hidden rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold sm:block">New</button></header>
        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-3 py-6 sm:px-6">
          {!active || active.messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white">✦</div><h1 className="text-3xl font-semibold tracking-tight text-slate-900">What can I help you grow?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Ask about your workspace, growth signals, competitors, trends, or actions.</p><div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{starters.map((s) => <button key={s} type="button" disabled={busy || selectedUnavailable} onClick={() => void sendMessage(s)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 hover:border-emerald-300 disabled:opacity-50">{s}</button>)}</div></div> : <div className="mx-auto max-w-3xl space-y-6">{active.messages.map((m) => <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={m.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "w-full max-w-[94%]"}><div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"}><div className="whitespace-pre-wrap" dir="auto">{m.content}</div></div>{m.role === "assistant" && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{m.provider && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500">{providerNames[m.provider]} · {m.model}</span>}{(m.steps ?? []).map((s, i) => <span key={`${m.id}-${i}`} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">{toolLabel[s.tool] ?? s.tool}</span>)}</div>}</div></div>)}{busy && <div className="flex justify-start"><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Thinking…</div></div>}<div ref={endRef}/></div>}
        </div>
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">{error && <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}<form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }} placeholder={model ? `Message ${providerNames[provider]} · ${model}…` : "Choose a model…"} rows={1} disabled={busy || selectedUnavailable || !model} className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-60"/><button type="submit" disabled={busy || !input.trim() || !active || selectedUnavailable || !model} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white disabled:bg-slate-200" aria-label="Send message">↑</button></form><p className="mx-auto mt-2 max-w-3xl px-1 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line · {providerNames[provider]} · {model || "no model"}</p></div>
      </div>
    </section>
  );
}
