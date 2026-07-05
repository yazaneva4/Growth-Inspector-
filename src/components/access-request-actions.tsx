"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccessRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const res = await fetch("/api/access/decision", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json();
      if (data.setPasswordUrl) setLink(data.setPasswordUrl);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <div className="text-xs text-slate-500">
        Approved. Share this set-password link (email isn&apos;t configured):
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("approve")}
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {busy ? "…" : "Approve"}
      </button>
      <button
        onClick={() => decide("reject")}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
