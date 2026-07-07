"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignControl({
  conversationId,
  assignedTo,
  currentUserId,
  teammates,
}: {
  conversationId: string;
  assignedTo: string | null;
  currentUserId: string;
  teammates: { user_id: string; email: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function assign(userId: string | null) {
    setBusy(true);
    setOpen(false);
    try {
      await fetch(`/api/conversations/${conversationId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: userId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const assignee = teammates.find((t) => t.user_id === assignedTo);
  const mine = assignedTo === currentUserId;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
          assignedTo
            ? mine
              ? "border-emerald-500/40 text-emerald-600"
              : "border-slate-300 text-slate-600"
            : "border-amber-500/40 text-amber-700"
        }`}
      >
        {assignedTo ? `👤 ${mine ? "You" : assignee?.email ?? "Assigned"}` : "Unassigned"}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          {!mine && (
            <button
              onClick={() => assign(currentUserId)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-600 hover:bg-slate-100"
            >
              Assign to me
            </button>
          )}
          {assignedTo && (
            <button
              onClick={() => assign(null)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              Unassign
            </button>
          )}
          {teammates.length > 0 && (
            <div className="mt-1 border-t border-slate-200 pt-1">
              {teammates.map((t) => (
                <button
                  key={t.user_id}
                  onClick={() => assign(t.user_id)}
                  disabled={t.user_id === assignedTo}
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  dir="auto"
                >
                  {t.user_id === currentUserId ? "You" : t.email}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
