"use client";

import { useState } from "react";
import type { ResponderResult } from "@/lib/ai/responder";

type Turn =
  | { who: "customer"; body: string }
  | { who: "ai"; body: string; result: ResponderResult }
  | { who: "system"; body: string };

const SAMPLES = [
  "كم سعر العود الكمبودي؟ وكم يوصل للرياض؟",
  "3ndkم توصيل اليوم؟ ابي هديه ضروري",
  "والله خدمتكم سيئة، الطلب تأخر اسبوع كامل 😡",
  "Do you ship to Jeddah and what are the prices?",
];

const decisionStyle: Record<string, string> = {
  send: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  draft: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  escalate: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export default function InboxSimulator() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"autonomous" | "approval">("autonomous");
  const [loading, setLoading] = useState(false);

  async function send(message: string) {
    if (!message.trim() || loading) return;
    setInput("");
    const history = turns
      .filter((t) => t.who !== "system")
      .map((t) => ({ author: t.who, body: t.body }));
    setTurns((t) => [...t, { who: "customer", body: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, replyMode: mode, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns((t) => [
          ...t,
          { who: "system", body: data.error ?? "Error" },
        ]);
        return;
      }
      const result = data as ResponderResult;
      if (result.decision === "escalate") {
        setTurns((t) => [
          ...t,
          {
            who: "system",
            body:
              "Escalated to a human" +
              (result.escalation_reason
                ? ` (${result.escalation_reason.replace(/_/g, " ")})`
                : "") +
              (result.reply ? `. Draft saved: “${result.reply}”` : "."),
          },
        ]);
      } else {
        setTurns((t) => [...t, { who: "ai", body: result.reply, result }]);
      }
    } catch {
      setTurns((t) => [...t, { who: "system", body: "Network error" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox · live demo</h1>
        <div className="flex rounded-lg border border-slate-700 text-xs">
          {(["autonomous", "approval"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 capitalize ${
                mode === m ? "bg-emerald-500 text-slate-950" : "text-slate-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Type as a customer (Arabic, dialect, Arabizi or English). The responder
        analyzes, applies guardrails, and replies or escalates.
      </p>

      <div className="mt-5 min-h-[320px] space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {turns.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            Start by sending a message below 👇
          </p>
        )}
        {turns.map((t, i) => {
          if (t.who === "system")
            return (
              <div key={i} className="text-center text-xs text-rose-300">
                ⚠ {t.body}
              </div>
            );
          const mine = t.who === "customer";
          return (
            <div
              key={i}
              className={`flex ${mine ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  mine
                    ? "bg-slate-800 text-slate-100"
                    : "bg-emerald-500 text-slate-950"
                }`}
                dir="auto"
              >
                {t.body}
                {t.who === "ai" && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      className={`rounded border px-1.5 py-0.5 ${decisionStyle[t.result.decision]}`}
                    >
                      {t.result.decision} ·{" "}
                      {(t.result.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-300">
                      {t.result.analysis.intent}
                    </span>
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-300">
                      {t.result.analysis.language}
                    </span>
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-300">
                      lead {t.result.analysis.lead_score}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="text-right text-xs text-slate-500">thinking…</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            dir="auto"
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            {s.length > 32 ? s.slice(0, 32) + "…" : s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="auto"
          placeholder="Write a customer message…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
