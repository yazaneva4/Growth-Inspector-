"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompetitorForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, platform, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setHandle("");
      setNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        required
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="@competitor"
        dir="auto"
        className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
      />
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
      >
        {["instagram", "x", "tiktok", "snapchat", "whatsapp"].map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        dir="auto"
        className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "…" : "Watch"}
      </button>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </form>
  );
}
