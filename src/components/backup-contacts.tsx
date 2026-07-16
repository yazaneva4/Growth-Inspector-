"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; name: string; phone: string };

/** wa.me deep link with a friendly, pre-filled thank-you message — opens
 *  WhatsApp with the text ready to send, no API/integration required. */
function thankYouLink(contact: Contact): string {
  const digits = contact.phone.replace(/[^\d]/g, "");
  const firstName = contact.name.trim().split(/\s+/)[0];
  const message = `Hi ${firstName}, just wanted to say thank you for all your hard work — really appreciate you being part of the GrowthSpace team! 🙌`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

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
              <div className="flex items-center gap-2">
                <a
                  href={thankYouLink(c)}
                  target="_blank"
                  rel="noreferrer"
                  title={`Thank ${c.name} on WhatsApp`}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36h.55c.18 0 .41-.03.64.49.24.53.8 1.83.87 1.96.07.13.12.29.02.47-.1.19-.15.3-.29.46-.14.16-.3.36-.43.48-.14.13-.29.28-.13.55.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.32 1.44.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/>
                  </svg>
                  Thank you
                </a>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busy}
                  className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
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
