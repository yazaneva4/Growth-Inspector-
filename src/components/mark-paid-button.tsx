"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkPaidButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to mark invoice as paid");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to mark invoice as paid"); }
    finally { setBusy(false); }
  }

  return <div className="inline-flex flex-col items-end gap-1">
    <button onClick={markPaid} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">{busy ? "…" : "Mark paid"}</button>
    {error && <span className="max-w-48 text-right text-[10px] text-rose-600">{error}</span>}
  </div>;
}
