"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface AgentRun {
  goal: string;
  steps: AgentStep[];
  answer: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  createdAt: number;
}

const STORAGE_KEY = "growth-inspector-custom-chat-v1";
const STARTER_PROMPTS = [
  "How are we doing this week?",
  "What are the biggest growth opportunities right now?",
  "What should we post about based on recent customer questions?",
  "Show me the latest trend radar.",
];

const TOOL_LABELS: Record<string, string> = {
  get_analytics_summary: "Analytics",
  get_competitors: "Competitors",
  get_trend_radar: "Trend radar",
  send_email: "Email",
  send_whatsapp: "WhatsApp",
};

function whatsappLinkFrom(steps: AgentStep[] | undefined): string | null {
  for (const step of steps ?? []) {
    const result = step.result as { whatsapp_link?: unknown } | null;
    if (result && typeof result.whatsapp_link === "string") {
      return result.whatsapp_link;
    }
  }
  return null;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (message): message is ChatMessage =>
        typeof message === "object" &&
        message !== null &&
        (message as ChatMessage).role !== undefined &&
        typeof (message as ChatMessage).content === "string",
    );
  } catch {
    return [];
  }
}

export function GrowthChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;
  const recentContext = useMemo(
    () =>
      messages
        .slice(-8)
        .map((message) => `${message.role === "user" ? "User" : "Growth Operator"}: ${message.content}`)
        .join("\n"),
    [messages],
  );

  function startNewChat() {
    setMessages([]);
    setInput("");
    setError(null);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusy(true);
    setError(null);

    const contextBlock = recentContext
      ? `\n\nConversation context from this chat:\n${recentContext}\n\nAnswer the newest user message, while using the context when useful.`
      : "";

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: `${trimmed}${contextBlock}` }),
      });

      const data = (await response.json().catch(() => null)) as AgentRun & {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Growth Operator could not answer right now.");
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: data?.answer ?? "I didn't get an answer back.",
        steps: data?.steps ?? [],
        createdAt: Date.now(),
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">✦</span>
            <div>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Growth Operator</h1>
              <p className="text-xs text-slate-500">Your custom Growth Inspector chat</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={startNewChat}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          New chat
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50/60 px-3 py-5 sm:px-6">
        {!hasMessages ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-10 text-center sm:py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-sm">✦</div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What are we growing today?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Ask about analytics, competitors, trends, leads, content ideas, or an action you want Growth Inspector to prepare.
            </p>
            <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={busy}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => {
              const whatsappLink = whatsappLinkFrom(message.steps);
              return (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[88%] sm:max-w-[75%]" : "w-full max-w-[92%] sm:max-w-[85%]"}>
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white shadow-sm"
                          : "rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm"
                      }
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>

                    {message.role === "assistant" && message.steps && message.steps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                        {message.steps.map((step, index) => (
                          <span
                            key={`${message.id}-${index}`}
                            className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500"
                          >
                            {TOOL_LABELS[step.tool] ?? step.tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Open WhatsApp draft
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

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
          <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">Dismiss</button>
          </div>
        )}
        <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
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
            placeholder="Message Growth Operator…"
            rows={1}
            dir="auto"
            disabled={busy}
            className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
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
        <p className="mx-auto mt-2 max-w-3xl px-1 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line · Chat history is kept in this browser.</p>
      </div>
    </section>
  );
}
