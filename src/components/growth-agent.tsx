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
};

type Providers = Record<Provider, { configured: boolean; model: string }>;

const STORAGE_KEY = "growth-inspector-operator-conversations-v2";
const PROVIDER_KEY = "growth-inspector-operator-provider-v1";
const MAX_CONVERSATIONS = 30;

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

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Conversation => {
      return Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as Conversation).id === "string" &&
          typeof (item as Conversation).title === "string" &&
          Array.isArray((item as Conversation).messages),
      );
    });
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
}

function makeConversation(): Conversation {
  const now = Date.now();
  return { id: id(), title: "New conversation", messages: [], createdAt: now, updatedAt: now };
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New conversation";
}

export function GrowthAgent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Providers>({
    gemini: { configured: true, model: "gemini" },
    gpt: { configured: false, model: "GPT" },
  });
  const [provider, setProvider] = useState<Provider>("gemini");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = loadConversations();
    if (stored.length > 0) {
      setConversations(stored);
      setActiveId(stored[0].id);
    } else {
      const conversation = makeConversation();
      setConversations([conversation]);
      setActiveId(conversation.id);
    }

    const savedProvider = localStorage.getItem(PROVIDER_KEY);
    if (savedProvider === "gemini" || savedProvider === "gpt") setProvider(savedProvider);

    fetch("/api/agent")
      .then((res) => res.json())
      .then((data) => {
        if (data?.providers) setProviders(data.providers as Providers);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (conversations.length) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, conversations, busy]);

  useEffect(() => {
    if (provider === "gpt" && !providers.gpt.configured && providers.gemini.configured) {
      setProvider("gemini");
    }
  }, [provider, providers]);

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0] ?? null,
    [activeId, conversations],
  );

  function updateActiveMessages(messages: ChatMessage[]) {
    if (!active) return;
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === active.id
            ? {
                ...conversation,
                messages,
                title: conversation.messages.length === 0 && messages[0]?.role === "user" ? titleFrom(messages[0].content) : conversation.title,
                updatedAt: Date.now(),
              }
            : conversation,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function newChat() {
    const next = makeConversation();
    setConversations((current) => [next, ...current].slice(0, MAX_CONVERSATIONS));
    setActiveId(next.id);
    setInput("");
    setError(null);
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function chooseProvider(next: Provider) {
    if (next === "gpt" && !providers.gpt.configured) return;
    setProvider(next);
    localStorage.setItem(PROVIDER_KEY, next);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !active) return;

    const userMessage: ChatMessage = {
      id: id(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const history = [...active.messages, userMessage];
    updateActiveMessages(history);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: trimmed,
          provider,
          history: active.messages.slice(-16).map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Growth Operator could not answer right now.");

      const assistantMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: data?.answer ?? "I didn't get an answer back.",
        steps: Array.isArray(data?.steps) ? data.steps : [],
        provider: data?.provider,
        model: data?.model,
        createdAt: Date.now(),
      };
      updateActiveMessages([...history, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="flex h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close conversation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Growth Operator</p>
            <p className="text-[11px] text-slate-500">AI workspace</p>
          </div>
          <button type="button" onClick={newChat} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            + New chat
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                setActiveId(conversation.id);
                setSidebarOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${conversation.id === active?.id ? "bg-emerald-500/10 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <div className="truncate font-medium">{conversation.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{conversation.messages.length} messages</div>
            </button>
          ))}
        </div>
        <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
          Conversations are saved in this browser.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversation menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">✦</span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">Growth Operator</h2>
                <p className="text-[11px] text-slate-500">Your AI growth teammate</p>
              </div>
            </div>
          </div>
          <select
            value={provider}
            onChange={(event) => chooseProvider(event.target.value as Provider)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
            aria-label="Choose AI model"
          >
            <option value="gemini">Gemini{providers.gemini.configured ? "" : " (not configured)"}</option>
            <option value="gpt" disabled={!providers.gpt.configured}>GPT{providers.gpt.configured ? "" : " (not configured)"}</option>
          </select>
          <button type="button" onClick={newChat} className="hidden rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:block">
            New
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-3 py-6 sm:px-6">
          {active?.messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-sm">✦</div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">What can I help you grow?</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                I can inspect your workspace, reason over growth signals, use the available tools, and take clearly requested actions.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendMessage(starter)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {active?.messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "w-full max-w-[94%]"}>
                    <div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white" : "rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"}>
                      <div className="whitespace-pre-wrap" dir="auto">{message.content}</div>
                    </div>
                    {message.role === "assistant" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                        {message.provider && (
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">
                            {message.provider === "gpt" ? "GPT" : "Gemini"}{message.model ? ` · ${message.model}` : ""}
                          </span>
                        )}
                        {(message.steps ?? []).map((step, index) => (
                          <span key={`${message.id}-${index}`} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
                            {toolLabel[step.tool] ?? step.tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    <span className="inline-flex items-center gap-1.5" aria-label="Growth Operator is thinking">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
          {error && (
            <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder={`Message Growth Operator with ${provider === "gpt" ? "GPT" : "Gemini"}…`}
              rows={1}
              dir="auto"
              disabled={busy}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              ↑
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl px-1 text-[11px] text-slate-400">
            Growth Operator can use workspace tools. Choose Gemini or GPT from the model menu.
          </p>
        </div>
      </div>
    </section>
  );
}
