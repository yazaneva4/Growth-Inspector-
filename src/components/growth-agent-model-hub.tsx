"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Provider = "openai" | "anthropic" | "zai" | "gemini";
type Model = { id: string; name: string };
type ProviderState = { configured: boolean; models: Model[] };
type Providers = Record<Provider, ProviderState>;
type Message = { id: string; role: "user" | "assistant"; content: string; provider?: Provider; model?: string; steps?: { tool: string }[]; createdAt: number };
type Conversation = { id: string; title: string; messages: Message[]; archived?: boolean; updatedAt: number };

const PROVIDER_LABEL: Record<Provider, string> = { openai: "GPT / OpenAI", anthropic: "Anthropic / Claude", zai: "z.ai / GLM", gemini: "Google / Gemini" };
const STORAGE = "growth-inspector-operator-model-hub-v1";
const PROVIDER_STORAGE = "growth-inspector-operator-selected-provider-v1";
const MODEL_STORAGE = "growth-inspector-operator-selected-model-v1";
const emptyProviders: Providers = {
  openai: { configured: false, models: [] },
  anthropic: { configured: false, models: [] },
  zai: { configured: false, models: [] },
  gemini: { configured: false, models: [] },
};

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function freshChat(): Conversation { return { id: id(), title: "New conversation", messages: [], updatedAt: Date.now() }; }
function makeTitle(text: string) { const t = text.replace(/\s+/g, " ").trim(); return t.length > 48 ? `${t.slice(0, 48)}…` : t || "New conversation"; }
function load(): Conversation[] { try { const raw = localStorage.getItem(STORAGE); const value = JSON.parse(raw || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }

export function GrowthAgentModelHub() {
  const [providers, setProviders] = useState<Providers>(emptyProviders);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function refreshModels() {
    try {
      const res = await fetch("/api/agent", { cache: "no-store" });
      const data = await res.json();
      if (data?.providers) setProviders(data.providers as Providers);
    } catch { setError("Could not refresh model availability."); }
  }

  useEffect(() => {
    const stored = load();
    const initial = stored.length ? stored : [freshChat()];
    setChats(initial); setActiveId(initial[0].id);
    const savedProvider = localStorage.getItem(PROVIDER_STORAGE) as Provider | null;
    if (savedProvider && savedProvider in emptyProviders) setProvider(savedProvider);
    const savedModel = localStorage.getItem(MODEL_STORAGE);
    if (savedModel) setModel(savedModel);
    void refreshModels();
  }, []);

  useEffect(() => { if (chats.length) localStorage.setItem(STORAGE, JSON.stringify(chats.slice(0, 50))); }, [chats]);
  useEffect(() => { const selected = providers[provider]?.models.find((m) => m.id === model); if (!selected && providers[provider]?.models.length) setModel(providers[provider].models[0].id); }, [provider, model, providers]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, chats, busy]);

  const active = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);
  const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p].configured || providers[p].models.length);
  const currentModels = providers[provider]?.models ?? [];
  const visibleChats = chats.filter((c) => Boolean(c.archived) === archived && (!search.trim() || c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))));
  const currentUnavailable = Boolean(unavailable[`${provider}:${model}`]);

  function updateActive(messages: Message[]) {
    if (!active) return;
    setChats((current) => current.map((c) => c.id === active.id ? { ...c, messages, updatedAt: Date.now(), title: c.messages.length === 0 ? makeTitle(messages[0]?.content || c.title) : c.title, archived: false } : c));
  }

  function newChat() { const next = freshChat(); setChats((current) => [next, ...current].slice(0, 50)); setActiveId(next.id); setInput(""); setError(null); setMenu(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  function archiveChat(chatId: string) { setChats((current) => current.map((c) => c.id === chatId ? { ...c, archived: true, updatedAt: Date.now() } : c)); if (chatId === activeId) newChat(); }
  function restoreChat(chatId: string) { setChats((current) => current.map((c) => c.id === chatId ? { ...c, archived: false, updatedAt: Date.now() } : c)); setActiveId(chatId); setArchived(false); }
  function deleteChat(chatId: string) { const remaining = chats.filter((c) => c.id !== chatId); const next = remaining.length ? remaining : [freshChat()]; setChats(next); if (chatId === activeId) setActiveId(next[0].id); }
  function startRename(chat: Conversation) { setRenameId(chat.id); setRenameValue(chat.title); }
  function finishRename() { if (!renameId) return; const value = renameValue.trim(); if (value) setChats((current) => current.map((c) => c.id === renameId ? { ...c, title: value.slice(0, 80), updatedAt: Date.now() } : c)); setRenameId(null); setRenameValue(""); }
  function chooseProvider(next: Provider) { setProvider(next); localStorage.setItem(PROVIDER_STORAGE, next); const nextModel = providers[next]?.models[0]?.id || ""; setModel(nextModel); if (nextModel) localStorage.setItem(MODEL_STORAGE, nextModel); setError(null); }
  function chooseModel(next: string) { setModel(next); localStorage.setItem(MODEL_STORAGE, next); setError(null); }

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy || !active || !provider || !model || currentUnavailable) return;
    const user: Message = { id: id(), role: "user", content: value, createdAt: Date.now() };
    const history = [...active.messages, user];
    updateActive(history); setInput(""); setBusy(true); setError(null);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: value, provider, model, history: active.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })) }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.temporaryUnavailable) {
          setUnavailable((current) => ({ ...current, [`${provider}:${model}`]: true }));
          setError(`${data?.provider === "anthropic" ? "Anthropic" : data?.provider === "openai" ? "GPT" : data?.provider === "zai" ? "z.ai" : "Google Gemini"} · ${data?.model || model} is temporarily unavailable.`);
          return;
        }
        throw new Error(data?.error || "Growth Operator could not answer.");
      }
      const assistant: Message = { id: id(), role: "assistant", content: data?.answer || "No answer returned.", provider: data?.provider, model: data?.model, steps: Array.isArray(data?.steps) ? data.steps : [], createdAt: Date.now() };
      updateActive([...history, assistant]);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }

  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void send(input); }
  const providerName = PROVIDER_LABEL[provider];

  return (
    <section className="flex min-h-[700px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {menu && <button aria-label="Close menu" onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-slate-200 p-3"><div className="flex items-center justify-between"><div><div className="font-semibold">Growth Operator</div><div className="text-[11px] text-slate-500">AI conversations</div></div><button onClick={newChat} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">+ New chat</button></div></div>
        <div className="border-b border-slate-200 p-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" /><div className="mt-2 flex gap-1 text-[11px]"><button onClick={() => setArchived(false)} className={`rounded-lg px-2.5 py-1.5 ${!archived ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-500"}`}>Recent</button><button onClick={() => setArchived(true)} className={`rounded-lg px-2.5 py-1.5 ${archived ? "bg-amber-50 text-amber-700 font-semibold" : "text-slate-500"}`}>Archived</button></div></div>
        <div className="flex-1 overflow-y-auto p-2">{visibleChats.map((chat) => <div key={chat.id} className={`group rounded-xl ${chat.id === activeId ? "bg-emerald-50" : "hover:bg-slate-50"}`}><button onClick={() => { setActiveId(chat.id); setMenu(false); }} className="w-full px-3 py-2 text-left">{renameId === chat.id ? <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={finishRename} onKeyDown={(e) => e.key === "Enter" && finishRename()} className="w-full rounded-lg border px-2 py-1 text-xs" /> : <div className="truncate text-sm font-medium">{chat.title}</div>}<div className="text-[10px] text-slate-400">{chat.messages.length} messages</div></button><div className="flex gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100">{archived ? <button onClick={() => restoreChat(chat.id)} className="text-[10px] text-emerald-700">Restore</button> : <><button onClick={() => startRename(chat)} className="text-[10px] text-slate-500">Rename</button><button onClick={() => archiveChat(chat.id)} className="text-[10px] text-slate-500">Archive</button></>}<button onClick={() => deleteChat(chat.id)} className="text-[10px] text-rose-500">Delete</button></div></div>)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 sm:p-4"><button onClick={() => setMenu(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 lg:hidden">☰</button><div className="min-w-0 flex-1"><div className="truncate font-semibold">{active?.title || "Growth Operator"}</div><div className="text-[11px] text-slate-500">Real AI agent · real APIs</div></div><select value={provider} onChange={(e) => chooseProvider(e.target.value as Provider)} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"><optgroup label="Providers">{availableProviders.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}{providers[p].configured ? "" : " · Not configured"}</option>)}</optgroup></select><select value={model} onChange={(e) => chooseModel(e.target.value)} disabled={!currentModels.length} className="max-w-[280px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"><optgroup label={providerName}>{currentModels.map((m) => <option key={m.id} value={m.id} disabled={Boolean(unavailable[`${provider}:${m.id}`])}>{unavailable[`${provider}:${m.id}`] ? `${m.name} · Temporarily unavailable` : m.name}</option>)}</optgroup></select><button onClick={() => { setUnavailable({}); void refreshModels(); }} className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs">↻</button></header>
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">{!active || !active.messages.length ? <div className="mx-auto flex min-h-[560px] max-w-3xl flex-col items-center justify-center text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white">✦</div><h2 className="mt-5 text-3xl font-semibold">What can I help you grow?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Choose any configured model from GPT, Anthropic, z.ai, or Google Gemini and start a real Growth Operator conversation.</p></div> : <div className="mx-auto max-w-3xl space-y-5">{active.messages.map((message) => <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm text-white" : "max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"}><div className="whitespace-pre-wrap" dir="auto">{message.content}</div>{message.role === "assistant" && message.model && <div className="mt-2 text-[10px] text-slate-400">{message.provider ? PROVIDER_LABEL[message.provider] : "AI"} · {message.model}</div>}</div></div>)}{busy && <div className="text-sm text-slate-500">Thinking…</div>}<div ref={endRef} /></div>}</div>
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">{error && <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}<form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} rows={1} placeholder={currentUnavailable ? "Selected model is temporarily unavailable" : `Message with ${model || providerName}…`} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" disabled={busy || currentUnavailable || !model} /><button type="submit" disabled={busy || currentUnavailable || !input.trim() || !model} className="h-10 w-10 rounded-xl bg-emerald-500 text-white disabled:bg-slate-200">↑</button></form><div className="mx-auto mt-2 max-w-3xl text-[10px] text-slate-400">{providerName} · {model || "No model selected"} · Enter to send · Shift+Enter for newline</div></div>
      </div>
    </section>
  );
}
