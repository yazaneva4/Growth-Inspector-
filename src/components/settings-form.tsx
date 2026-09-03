"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandVoice, ReplyMode } from "@/lib/types";

export function SettingsForm({
  initial,
  canSave,
}: {
  initial: {
    voice: BrandVoice;
    reply_mode: ReplyMode;
    confidence_threshold: number;
  };
  canSave: boolean;
}) {
  const router = useRouter();
  const [tone, setTone] = useState(initial.voice.tone ?? "");
  const [facts, setFacts] = useState(initial.voice.facts ?? "");
  const [guardrails, setGuardrails] = useState((initial.voice.guardrails ?? []).join("\n"));
  const [instructions, setInstructions] = useState(initial.voice.instructions ?? "");
  const [mode, setMode] = useState<ReplyMode>(initial.reply_mode);
  const [threshold, setThreshold] = useState(initial.confidence_threshold);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, facts, guardrails, instructions, reply_mode: mode, confidence_threshold: threshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Tone — how the AI should sound">
        <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Warm, professional, light Khaleeji dialect" dir="auto" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
      </Field>

      <Field label="Growth AI instructions & feedback">
        <textarea
          rows={6}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={"Tell Growth AI how you want it to work. For example:\nAlways explain your recommendation before taking an action.\nUse concise bullet points for analytics.\nIf I correct an answer, use that feedback in this workspace."}
          dir="auto"
          maxLength={8000}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <p className="mt-1 text-xs text-slate-500">These workspace instructions are included with Growth AI requests and saved with your workspace.</p>
      </Field>

      <Field label="Business facts the AI may use">
        <textarea rows={4} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="Hours, delivery times, return policy, product list…" dir="auto" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
      </Field>

      <Field label="Never do / say (one per line)">
        <textarea rows={3} value={guardrails} onChange={(e) => setGuardrails(e.target.value)} placeholder={"Never promise discounts not approved by the team\nNever share competitor info"} dir="auto" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reply mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as ReplyMode)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500">
            <option value="autonomous">Autonomous — AI sends automatically</option>
            <option value="approval">Approval — AI drafts, human sends</option>
            <option value="off">Off — no AI replies</option>
          </select>
        </Field>

        <Field label={`Confidence threshold — ${(threshold * 100).toFixed(0)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="mt-3 w-full accent-emerald-500" />
          <p className="text-xs text-slate-500">Replies below this confidence escalate to a human.</p>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? "Saving…" : canSave ? "Save settings" : "Sign in to save"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved ✓</span>}
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </label>
  );
}
