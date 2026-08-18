"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

type Provider = "gemini" | "gpt";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  provider?: Provider;
  model?: string;
  createdAt: number;
};
type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
};
type Providers = Record<Provider, { configured: boolean; model: string }>;

const STORAGE_KEY = "growth-inspector-operator-conversations-v3";
const PROVIDER_KEY = "growth-inspector-operator-provider-v1";
const MAX_CONVERSATIONS = 50;

const toolLabel: Record<string, string> = {
  get_analytics_summary: "Analytics",
  get_competitors: "Competitors",
  get_trend_radar: "Trend radar",
  send_email: "Email",
  send_whatsapp: "WhatsApp",
};

const starters = [
  "How are we doing this week?",
  "What are our biggest growth opportunities right now?",
  "Check the latest trend radar.",
  "What should I focus on today?",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function makeConversation(): Conversation {
  const now = Date.now();
  return { id: makeId(), title: "New conversation", messages: [], createdAt: now, updatedAt: now, archived: false };
}
function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New conversation";
}
function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Conversation => {
      if (!item || typeof item !== "object") return false;
      const value = item as Conversation;
      return typeof value.id === "string" && typeof value.title === "string" && Array.isArray(value.messages);
    });
  } catch {
    return [];
  }
}
function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS)));
}

export function GrowthAgent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Providers>({ gemini: { configured: false, model: "Gemini" }, gpt: { configured: false, model: "GPT" } });
  const [provider, setProvider] = useState<Provider>("gemini");
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

  useEffect(() => {
    const stored = loadConversations();
    const initial = stored.length ? stored : [makeConversation()];
    setConversations(initial);
    setActiveId(initial[0].id);
    const savedProvider = localStorage.getItem(PROVIDER_KEY);
    if (savedProvider === "gemini" || savedProvider === "gpt") setProvider(savedProvider);
    fetch("/api/agent").then((res) => res.json()).then((data) => { if (data?.providers) setProviders(data.providers as Providers); }).catch(() => undefined);
  }, []);

  useEffect(() => { if (conversations.length) saveConversations(conversations); }, [conversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, conversations, busy]);
  useEffect(() => { if (provider === "gpt" && !providers.gpt.configured && providers.gemini.configured) setProvider("gemini"); }, [provider, providers]);

  const visibleConversations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (showArchived !== Boolean(conversation.archived)) return false;
      if (!needle) return true;
      return conversation.title.toLowerCase().includes(needle) || conversation.messages.some((message) => message.content.toLowerCase().includes(needle));
    });
  }, [conversations, search, showArchived]);

  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) ?? null, [activeId, conversations]);

  function updateConversation(id: string, patch: Partial<Conversation>) {
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, ...patch, updatedAt: Date.now() } : conversation).sort((a, b) => b.updatedAt - a.updatedAt));
  }
  function updateActiveMessages(messages: ChatMessage[]) {
    if (!active) return;
    updateConversation(active.id, { messages, title: active.messages.length === 0 && messages[0]?.role === "user" ? titleFrom(messages[0].content) : active.title, archived: false });
  }
  function newChat() {
    const next = makeConversation();
    setConversations((current) => [next, ...current].slice(0, MAX_CONVERSATIONS));
    setActiveId(next.id); setInput(""); setError(null); setShowArchived(false); setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function archiveConversation(id: string) {
    updateConversation(id, { archived: true });
    if (id === activeId) {
      const replacement = conversations.find((conversation) => !conversation.archived && conversation.id !== id);
      if (replacement) setActiveId(replacement.id); else newChat();
    }
  }
  function restoreConversation(id: string) { updateConversation(id, { archived: false }); setShowArchived(false); setActiveId(id); }
  function deleteConversation(id: string) {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    const next = remaining.length ? remaining : [makeConversation()];
    setConversations(next); if (id === activeId) setActiveId(next[0].id);
  }
  function beginRename(conversation: Conversation) { setRenamingId(conversation.id); setRenameValue(conversation.title); }
  function finishRename() {
    if (!renamingId) return;
    const clean = renameValue.trim();
    if (clean) updateConversation(renamingId, { title: clean.slice(0, 80) });
    setRenamingId(null); setRenameValue("");
  }
  function chooseProvider(next: Provider) { if (!providers[next].configured) return; setProvider(next); localStorage.setItem(PROVIDER_KEY, next); }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !active) return;
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: trimmed, createdAt: Date.now() };
    const history = [...active.messages, userMessage];
    updateActiveMessages(history); setInput(""); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: trimmed, provider, history: active.messages.slice(-16).map((message) => ({ role: message.role, content: message.content })) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Growth Operator could not answer right now.");
      const assistantMessage: ChatMessage = { id: makeId(), role: "assistant", content: data?.answer ?? "I didn't get an answer back.", steps: Array.isArray(data?.steps) ? data.steps : [], provider: data?.provider, model: data?.model, createdAt: Date.now() };
      updateActiveMessages([...history, assistantMessage]);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(input); }

  return (
    <section className="flex h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {sidebarOpen && <button type="button" aria-label="Close conversation menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3">
          <div><p className="text-sm font-semibold text-slate-900">Growth Operator</p><p className="text-[11px] text-slate-500">AI conversations</p></div>
          <button type="button" onClick={newChat} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">+ New chat</button>
        </div>
        <div className="border-b border-slate-200 p-3">
          <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" /></div>
          <div className="mt-2 flex gap-1 text-[11px]"><button type="button" onClick={() => setShowArchived(false)} className={`rounded-lg px-2.5 py-1.5 ${!showArchived ? "bg-emerald-500/10 font-semibold text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}>Recent</button><button type="button" onClick={() => setShowArchived(true)} className={`rounded-lg px-2.5 py-1.5 ${showArchived ? "bg-amber-500/10 font-semibold text-amber-700" : "text-slate-500 hover:bg-slate-100"}`}>Archived</button></div>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibleConversations.length === 0 ? <div className="px-3 py-8 text-center text-xs text-slate-400">{showArchived ? "No archived chats" : "No matching chats"}</div> : visibleConversations.map((conversation) => (
            <div key={conversation.id} className={`group rounded-xl ${conversation.id === active?.id ? "bg-emerald-500/10" : "hover:bg-slate-100"}`}>
              <button type="button" onClick={() => { setActiveId(conversation.id); setSidebarOpen(false); }} className="w-full px-3 py-2.5 text-left">
                {renamingId === conversation.id ? <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === "Enter") finishRename(); if (event.key === "Escape") setRenamingId(null); }} onClick={(event) => event.stopPropagation()} className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs outline-none" /> : <><div className={`truncate text-sm font-medium ${conversation.id === active?.id ? "text-emerald-700" : "text-slate-700"}`}>{conversation.title}</div><div className="mt-0.5 text-[10px] text-slate-400">{conversation.messages.length} messages</div></>}
              </button>
              <div className="flex items-center gap-1 px-2 pb-2 opacity-0 transition group-hover:opacity-100">
                {!showArchived ? <><button type="button" onClick={() => beginRename(conversation)} className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-white">Rename</button><button type="button" onClick={() => archiveConversation(conversation.id)} className="rounded-md px-2 py-1 text-[10px] text-slate-500 hover:bg-white">Archive</button></> : <button type="button" onClick={() => restoreConversation(conversation.id)} className="rounded-md px-2 py-1 text-[10px] text-emerald-600 hover:bg-white">Restore</button>}
                <button type="button" onClick={() => deleteConversation(conversation.id)} className="rounded-md px-2 py-1 text-[10px] text-rose-500 hover:bg-rose-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-3 text-[10px] text-slate-400">Chats are saved locally on this browser. Archive hides a chat without deleting it.</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-3 sm:px-5">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open conversation menu" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden">☰</button>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">✦</span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{active?.title ?? "Growth Operator"}</h2><p className="text-[11px] text-slate-500">Your AI growth teammate</p></div></div></div>
          <select value={provider} onChange={(event) => chooseProvider(event.target.value as Provider)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500" aria-label="Choose AI model"><option value="gemini">Gemini{providers.gemini.configured ? "" : " · unavailable"}</option><option value="gpt" disabled={!providers.gpt.configured}>GPT{providers.gpt.configured ? "" : " · unavailable"}</option></select>
          <button type="button" onClick={newChat} className="hidden rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:block">New</button>
        </header>
        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-3 py-6 sm:px-6">
          {!active || active.messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-sm">✦</div><h1 className="text-3xl font-semibold tracking-tight text-slate-900">What can I help you grow?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">I can inspect your workspace, reason over growth signals, use available tools, and take clearly requested actions.</p><div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{starters.map((starter) => <button key={starter} type="button" disabled={busy} onClick={() => void sendMessage(starter)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50">{starter}</button>)}</div></div> : <div className="mx-auto max-w-3xl space-y-6">{active.messages.map((message) => <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={message.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "w-full max-w-[94%]"}><div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"}><div className="whitespace-pre-wrap" dir="auto">{message.content}</div></div>{message.role === "assistant" && <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">{message.provider && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">{message.provider === "gpt" ? "GPT" : "Gemini"}{message.model ? ` · ${message.model}` : ""}</span>}{(message.steps ?? []).map((step, index) => <span key={`${message.id}-${index}`} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">{toolLabel[step.tool] ?? step.tool}</span>)}</div>}</div></div>)}{busy && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm"><span className="inline-flex items-center gap-1.5" aria-label="Growth Operator is thinking"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"/><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]"/><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]"/></span></div></div>}<div ref={endRef}/></div>}
        </div>
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">{error && <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}<form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100"><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} placeholder="Message Growth Operator…" rows={1} dir="auto" disabled={busy} className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"/><button type="submit" disabled={busy || !input.trim() || !active} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">↑</button></form><p className="mx-auto mt-2 max-w-3xl px-1 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line · {provider === "gpt" ? "GPT" : "Gemini"} selected</p></div>
      </div>
    </section>
  );
}
