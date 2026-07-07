"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; name: string; phone: string };

export function BackupContacts({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setName("");
      setPhone("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch("/api/settings/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {contacts.length > 0 && (
        <div className="mb-4 space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium" dir="auto">{c.name}</span>
                <span className="ml-2 text-slate-500">{c.phone}</span>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={busy}
                className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          dir="auto"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="sm:col-span-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "…" : "Add contact"}
        </button>
        {error && <p className="sm:col-span-2 text-xs text-rose-600">{error}</p>}
      </form>
    </div>
  );
}
