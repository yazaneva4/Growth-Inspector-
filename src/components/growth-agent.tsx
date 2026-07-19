"use client";

import { useEffect, useState } from "react";

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

const SAMPLE_GOALS = [
  "How are we doing this week? Give me the highlights.",
  "What should we post about based on recent customer questions?",
  "Email a weekly summary to owner@example.com",
  "WhatsApp 966501234567 a friendly check-in message",
];

const toolLabel: Record<string, string> = {
  get_analytics_summary: "📊 Checked analytics",
  get_competitors: "🎯 Checked competitors",
  get_trend_radar: "📡 Checked trend radar",
  send_email: "✉️ Sent email",
  send_whatsapp: "🟢 Prepared WhatsApp",
};

/** Pull any WhatsApp link the agent prepared out of its step results. */
function whatsappLinkFrom(run: AgentRun): string | null {
  for (const s of run.steps) {
    const r = s.result as { whatsapp_link?: string } | null;
    if (r && typeof r.whatsapp_link === "string") return r.whatsapp_link;
  }
  return null;
}

export function GrowthAgent() {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When the agent prepares a WhatsApp message, open it automatically (popup
  // blockers may stop this — the button below always works as a fallback).
  const waLink = run ? whatsappLinkFrom(run) : null;
  useEffect(() => {
    if (waLink) window.open(waLink, "_blank", "noopener");
  }, [waLink]);

  async function submit(g?: string) {
    const goalText = (g ?? goal).trim();
    if (!goalText) return;
    setBusy(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent failed");
      setRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SAMPLE_GOALS.map((g) => (
          <button
            key={g}
            onClick={() => {
              setGoal(g);
              submit(g);
            }}
            disabled={busy}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {g}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ask Growth Operator a goal…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "Working…" : "Run"}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {run && (
        <div className="space-y-3">
          {run.steps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {run.steps.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-600"
                >
                  {toolLabel[s.tool] ?? s.tool}
                </span>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed whitespace-pre-wrap">
            {run.answer}
          </div>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36h.55c.18 0 .41-.03.64.49.24.53.8 1.83.87 1.96.07.13.12.29.02.47-.1.19-.15.3-.29.46-.14.16-.3.36-.43.48-.14.13-.29.28-.13.55.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.32 1.44.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/>
              </svg>
              Open WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
