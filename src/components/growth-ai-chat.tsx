"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "auto" | "openai" | "anthropic" | "zai" | "gemini" | "openrouter";
type RealProvider = Exclude<Provider, "auto">;
type Model = { id: string; name: string };
type ProviderState = { configured: boolean; models: Model[] };
type Providers = Record<RealProvider, ProviderState>;
type Message = { id: string; role: "user" | "assistant"; content: string; provider?: RealProvider; model?: string; createdAt: number; status?: "pending" | "failed" | "unsaved" };
type Conversation = { id: string; title: string; messages: Message[]; archived: boolean; updatedAt: number };
type ApiConversation = { id: string; title: string; archived: boolean; updated_at: string; ai_operator_messages?: Array<{ id: string; role: "user" | "assistant"; content: string; provider?: RealProvider | null; model?: string | null; created_at: string }> };

const LABEL: Record<RealProvider, string> = { openai: "GPT / OpenAI", anthropic: "Anthropic / Claude", zai: "z.ai / GLM", gemini: "Google / Gemini", openrouter: "OpenRouter" };
const REAL_PROVIDERS: RealProvider[] = ["openai", "anthropic", "zai", "gemini", "openrouter"];
const PROVIDER_KEY = "growth-ai-provider-v5";
const MODEL_KEY = (provider: RealProvider) => `growth-ai-model-${provider}-v5`;
const EMPTY: Providers = { openai: { configured: false, models: [] }, anthropic: { configured: false, models: [] }, zai: { configured: false, models: [] }, gemini: { configured: false, models: [] }, openrouter: { configured: false, models: [] } };

function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function titleFrom(text: string) { const value = text.replace(/\s+/g, " ").trim(); return value.length > 60 ? `${value.slice(0, 60)}…` : value || "New conversation"; }
function fromApi(value: ApiConversation): Conversation { return { id: value.id, title: value.title || "New conversation", archived: value.archived, updatedAt: Date.parse(value.updated_at) || Date.now(), messages: (value.ai_operator_messages ?? []).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).map((m) => ({ id: m.id, role: m.role, content: typeof m.content === "string" ? m.content : "", provider: m.provider ?? undefined, model: m.model ?? undefined, createdAt: Date.parse(m.created_at) || Date.now() })) }; }
function historyForModel(messages: Message[]) { const result: Array<{ role: "user" | "assistant"; content: string }> = []; let chars = 0; for (let i = messages.length - 1; i >= 0 && result.length < 64; i--) { const m = messages[i]; const content = typeof m.content === "string" ? m.content : ""; const size = content.length + 40; if (result.length && chars + size > 30000) break; result.unshift({ role: m.role, content }); chars += size; } return result; }

export function GrowthAiChat() {
  const [providers, setProviders] = useState<Providers>(EMPTY);
  const [provider, setProvider] = useState<Provider>("auto");
  const [model, setModel] = useState("auto");
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);

  async function refreshModels() { try { const res = await fetch("/api/agent", { cache: "no-store" }); const data = await res.json(); if (!res.ok || !data?.providers) throw new Error("Model service unavailable."); setProviders(data.providers as Providers); } catch (err) { setError(err instanceof Error ? err.message : "Could not load models."); } }
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
      const sameTab = next.find((c: Conversation) => c.archived === showArchived);
      const selected = current && next.some((c: Conversation) => c.id === current) ? current : (sameTab?.id ?? next[0].id);
      if (selectFirst || !current || !next.some((c: Conversation) => c.id === current)) {
        const selectedChat = next.find((c: Conversation) => c.id === selected);
        if (selectedChat && selectedChat.archived !== showArchived) setShowArchived(selectedChat.archived);
        activeIdRef.current = selected; setActiveId(selected);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load saved conversations."); }
  }

  useEffect(() => { const saved = localStorage.getItem(PROVIDER_KEY) as Provider | null; if (saved === "auto" || (saved && REAL_PROVIDERS.includes(saved as RealProvider))) setProvider(saved); void refreshModels(); void refreshChats(true); const supabase = createClient(); const channel = supabase.channel(`growth-ai-${makeId()}`).on("postgres_changes", { event: "*", schema: "public", table: "ai_operator_conversations" }, () => void refreshChats()).on("postgres_changes", { event: "*", schema: "public", table: "ai_operator_messages" }, () => void refreshChats()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [showArchived]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { if (provider === "auto") { setModel("auto"); return; } const saved = localStorage.getItem(MODEL_KEY(provider)); const models = providers[provider]?.models ?? []; const next = saved && models.some((m) => m.id === saved) && !unavailable[`${provider}:${saved}`] ? saved : models.find((m) => !unavailable[`${provider}:${m.id}`])?.id ?? ""; setModel(next); if (next) localStorage.setItem(MODEL_KEY(provider), next); }, [provider, providers, unavailable]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeId, chats, busy]);

  const active = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);
  const configuredProviders = REAL_PROVIDERS.filter((p) => providers[p].configured);
  const currentModels = provider === "auto" ? [] : providers[provider]?.models ?? [];
  const allModels = REAL_PROVIDERS.flatMap((p) => providers[p].configured ? providers[p].models.map((m) => ({ ...m, provider: p })) : []);
  const visible = chats.filter((c) => c.archived === showArchived && (!search.trim() || c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some((m) => String(m.content ?? "").toLowerCase().includes(search.toLowerCase()))));

  async function api(body: Record<string, unknown>) { const res = await fetch("/api/agent/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json().catch(() => null); if (!res.ok) throw new Error(data?.error || "Conversation update failed."); return data; }
  async function createChat() { try { const data = await api({ action: "create" }); const chat = fromApi({ ...data.conversation, ai_operator_messages: [] }); setChats((v) => [chat, ...v]); activeIdRef.current = chat.id; setActiveId(chat.id); setInput(""); setError(null); setMenu(false); requestAnimationFrame(() => inputRef.current?.focus()); } catch (err) { setError(err instanceof Error ? err.message : "Could not create conversation."); } }
  async function finishRename() { if (!renameId) return; const value = renameValue.trim(); if (value) { try { await api({ action: "update", conversationId: renameId, title: value.slice(0, 80) }); await refreshChats(); } catch (err) { setError(err instanceof Error ? err.message : "Could not rename conversation."); } } setRenameId(null); setRenameValue(""); }
  async function archiveChat(id: string, archived: boolean) { try { await api({ action: "update", conversationId: id, archived }); await refreshChats(); if (archived && id === activeId) await createChat(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update conversation."); } }
  async function deleteChat(id: string) { try { await api({ action: "delete", conversationId: id }); await refreshChats(true); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete conversation."); } }
  function chooseProvider(next: Provider) { setProvider(next); setModel(next === "auto" ? "auto" : (localStorage.getItem(MODEL_KEY(next)) || providers[next].models[0]?.id || "")); localStorage.setItem(PROVIDER_KEY, next); setError(null); }
  function chooseModel(next: string) { if (provider === "auto") return; if (!currentModels.some((m) => m.id === next)) return; setModel(next); localStorage.setItem(MODEL_KEY(provider), next); setError(null); }

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    if (provider === "auto" && !configuredProviders.length) { setError("No configured AI provider is available for Auto mode."); return; }
    if (provider !== "auto" && (!model || !providers[provider]?.configured)) { setError(`${LABEL[provider]} is not ready yet. Choose an available model and try again.`); return; }

    // The old flow silently returned when `active` was null. On a fresh/slow
    // load that made both Send and Enter appear completely broken. Create the
    // conversation synchronously and continue the same send operation.
    let current = active;
    if (!current) {
      try {
        const created = await api({ action: "create" });
        if (!created?.conversation?.id) throw new Error("Could not create a conversation.");
        current = fromApi({ ...created.conversation, ai_operator_messages: [] });
        activeIdRef.current = current.id;
        setActiveId(current.id);
        setChats((all) => [current!, ...all.filter((c) => c.id !== current!.id)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start a conversation.");
        return;
      }
    }

    const pendingId = makeId();
    const pendingUser: Message = { id: pendingId, role: "user", content: value, createdAt: Date.now(), status: "pending" };
    const history = historyForModel([...current.messages, pendingUser]);
    setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: [...c.messages, pendingUser], title: c.messages.length ? c.title : titleFrom(value), updatedAt: Date.now(), archived: false } : c));
    setInput(""); setBusy(true); setError(null);
    try {
      try { await api({ action: "message", conversationId: current.id, role: "user", content: value }); }
      catch (err) { setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: c.messages.map((m) => m.id === pendingId ? { ...m, status: "failed" } : m) } : c)); throw err; }

      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: value, provider, model: provider === "auto" ? "auto" : model, history }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.temporaryUnavailable) {
          const key = `${data.provider ?? provider}:${data.model ?? model}`;
          setUnavailable((v) => ({ ...v, [key]: true }));
          setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: c.messages.map((m) => m.id === pendingId ? { ...m, status: "failed" } : m) } : c));
          setError(`${LABEL[data?.provider as RealProvider] ?? "AI provider"} · ${data?.model ?? model} is temporarily unavailable. Auto will use another configured model on the next request.`);
          return;
        }
        throw new Error(data?.error || "Growth AI could not answer.");
      }

      const answer = typeof data?.answer === "string" ? data.answer : "No answer returned.";
      const assistant: Message = { id: makeId(), role: "assistant", content: answer, provider: data?.provider, model: data?.model, createdAt: Date.now() };
      try {
        await api({ action: "message", conversationId: current.id, role: "assistant", content: answer, provider: data?.provider, model: data?.model, steps: Array.isArray(data?.steps) ? data.steps : [] });
        setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: [...c.messages.map((m) => m.id === pendingId ? { ...m, status: undefined } : m), assistant] } : c));
        await refreshChats();
      } catch (persistErr) {
        setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: [...c.messages.map((m) => m.id === pendingId ? { ...m, status: undefined } : m), { ...assistant, status: "unsaved" }] } : c));
        setError(`Growth AI answered, but the answer could not be saved. ${persistErr instanceof Error ? persistErr.message : "Try again later."}`);
      }
    } catch (err) {
      setChats((all) => all.map((c) => c.id === current!.id ? { ...c, messages: c.messages.map((m) => m.id === pendingId ? { ...m, status: "failed" } : m) } : c));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  }

  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void send(input); }
  const providerName = provider === "auto" ? "⚡ Auto — all configured providers" : LABEL[provider];
  const modelLabel = provider === "auto" ? `Auto · ${allModels.length} available models across ${configuredProviders.length} API providers` : model || "No model selected";

  return <section className="flex min-h-[700px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    {menu && <button aria-label="Close menu" onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="border-b border-slate-200 p-3"><div className="flex items-center justify-between"><div><div className="font-semibold">Growth AI</div><div className="text-[11px] text-slate-500">Saved conversations + memory</div></div><button onClick={() => void createChat()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">+ New chat</button></div></div>
      <div className="border-b border-slate-200 p-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" /><div className="mt-2 flex gap-1 text-[11px]"><button onClick={() => setShowArchived(false)} className={`rounded-lg px-2.5 py-1.5 ${!showArchived ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-500"}`}>Recent</button><button onClick={() => setShowArchived(true)} className={`rounded-lg px-2.5 py-1.5 ${showArchived ? "bg-amber-50 text-amber-700 font-semibold" : "text-slate-500"}`}>Archived</button></div></div>
      <div className="flex-1 overflow-y-auto p-2">{visible.length ? visible.map((chat) => <div key={chat.id} className={`group rounded-xl ${chat.id === activeId ? "bg-emerald-50" : "hover:bg-slate-50"}`}><button onClick={() => { activeIdRef.current = chat.id; setActiveId(chat.id); setMenu(false); }} className="w-full px-3 py-2 text-left">{renameId === chat.id ? <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => void finishRename()} onKeyDown={(e) => e.key === "Enter" && void finishRename()} className="w-full rounded-lg border px-2 py-1 text-xs" /> : <div className="truncate text-sm font-medium">{chat.title}</div>}<div className="text-[10px] text-slate-400">{chat.messages.length} messages · {new Date(chat.updatedAt).toLocaleDateString()}</div></button><div className="flex gap-2 px-2 pb-2 opacity-0 group-hover:opacity-100"><button onClick={() => { setRenameId(chat.id); setRenameValue(chat.title); }} className="text-[10px] text-slate-500">Rename</button>{chat.archived ? <button onClick={() => void archiveChat(chat.id, false)} className="text-[10px] text-emerald-700">Restore</button> : <button onClick={() => void archiveChat(chat.id, true)} className="text-[10px] text-slate-500">Archive</button>}<button onClick={() => void deleteChat(chat.id)} className="text-[10px] text-rose-500">Delete</button></div></div>) : <div className="px-3 py-8 text-center text-xs text-slate-400">No conversations</div>}</div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 sm:p-4"><button onClick={() => setMenu(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 lg:hidden">☰</button><div className="min-w-0 flex-1"><div className="truncate font-semibold">{active?.title || "Growth AI"}</div><div className="text-[11px] text-slate-500">Saved to workspace · live sync · {providerName}</div></div><select value={provider} onChange={(e) => chooseProvider(e.target.value as Provider)} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"><option value="auto">⚡ Auto — all providers</option>{configuredProviders.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}</select>{provider === "auto" ? <div className="max-w-[340px] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{allModels.length} models across {configuredProviders.length} configured API providers. Auto ranks the full pool and falls back across providers when a model is unavailable.</div> : <select value={model} onChange={(e) => chooseModel(e.target.value)} disabled={!currentModels.length || !providers[provider]?.configured} className="max-w-[280px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"><optgroup label={`${providerName} models`}>{currentModels.map((m) => <option key={m.id} value={m.id} disabled={Boolean(unavailable[`${provider}:${m.id}`])}>{unavailable[`${provider}:${m.id}`] ? `${m.name} · unavailable` : m.name}</option>)}</optgroup></select>}<button onClick={() => { setUnavailable({}); void refreshModels(); void refreshChats(); }} className="rounded-xl border border-slate-300 px-2.5 py-2 text-xs" title="Refresh models and conversations">↻</button></header>
      <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">{!active || !active.messages.length ? <div className="mx-auto flex min-h-[560px] max-w-3xl flex-col items-center justify-center text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white">✦</div><h2 className="mt-5 text-3xl font-semibold">What can I help you grow?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Conversations are saved in the Growth Inspector workspace and stay available when you return.</p></div> : <div className="mx-auto max-w-3xl space-y-5">{active.messages.map((message) => <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm text-white" : "max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"}><div className="whitespace-pre-wrap" dir="auto">{message.content}</div>{message.status === "pending" && <div className="mt-1 text-[10px] opacity-70">Saving…</div>}{message.status === "failed" && <div className="mt-1 text-[10px] font-semibold opacity-90">Not completed — send again to retry</div>}{message.status === "unsaved" && <div className="mt-1 text-[10px] font-semibold text-amber-700">Answer generated but not saved</div>}{message.role === "assistant" && message.model && <div className="mt-2 text-[10px] text-slate-400">{message.provider ? LABEL[message.provider] : "AI"} · {message.model}</div>}</div></div>)}{busy && <div className="text-sm text-slate-500">Growth AI is thinking…</div>}<div ref={endRef} /></div>}</div>
      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">{error && <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}<form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} rows={1} placeholder={provider === "auto" ? "Message Growth AI — Auto will choose across all configured providers…" : `Message with ${model || providerName}…`} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" disabled={busy || (provider !== "auto" && (!model || !providers[provider]?.configured))} /><button type="submit" disabled={busy || !input.trim() || (provider !== "auto" && (!model || !providers[provider]?.configured))} className="h-10 w-10 rounded-xl bg-emerald-500 text-white disabled:bg-slate-200">↑</button></form><div className="mx-auto mt-2 flex max-w-3xl justify-between text-[10px] text-slate-400"><span>{modelLabel}</span><span>Enter send · Shift+Enter newline · saved automatically</span></div></div>
    </div>
  </section>;
}
