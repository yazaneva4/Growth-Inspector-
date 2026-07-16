"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TeamMessage = {
  id: string;
  user_id: string | null;
  author_email: string;
  body: string;
  created_at: string;
};

function initials(email: string): string {
  return email.charAt(0).toUpperCase();
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TeamChat({
  messages,
  currentUserId,
}: {
  messages: TeamMessage[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/team-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setInput("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet. Say hello to your team 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = currentUserId && m.user_id === currentUserId;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-600"
                  title={m.author_email}
                >
                  {initials(m.author_email)}
                </span>
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  <div className="text-[10px] text-slate-400">
                    {mine ? "You" : m.author_email} · {timeLabel(m.created_at)}
                  </div>
                  <div
                    className={`mt-0.5 inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900"
                    }`}
                    dir="auto"
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your team…"
          dir="auto"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="px-3 pb-3 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
