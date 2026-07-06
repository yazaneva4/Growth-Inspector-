"use client";

import { useState } from "react";

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
  "Summarize our competitors and one way to differentiate.",
];

const toolLabel: Record<string, string> = {
  get_analytics_summary: "📊 Checked analytics",
  get_competitors: "🎯 Checked competitors",
  get_trend_radar: "📡 Checked trend radar",
};

export function GrowthAgent() {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          placeholder="Ask the Growth Agent a goal…"
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
        </div>
      )}
    </div>
  );
}
