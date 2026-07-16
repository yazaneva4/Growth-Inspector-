"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
};

/** wa.me deep link with the given (AI-written) message pre-filled — opens the
 *  real WhatsApp app/web with the text ready to send. */
function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function ClientRow({ client }: { client: Client }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/clients/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: client.name, company: client.company }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      setMessage(data.message as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch("/api/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium" dir="auto">{client.name}</span>
          {client.company && (
            <span className="ml-2 text-slate-500" dir="auto">· {client.company}</span>
          )}
          <span className="ml-2 text-slate-500">{client.phone}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={generate}
            disabled={busy}
            title="Generate an AI thank-you and send on WhatsApp"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36h.55c.18 0 .41-.03.64.49.24.53.8 1.83.87 1.96.07.13.12.29.02.47-.1.19-.15.3-.29.46-.14.16-.3.36-.43.48-.14.13-.29.28-.13.55.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.32 1.44.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/>
            </svg>
            {busy ? "…" : "Thank you"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {message && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3">
          <p className="whitespace-pre-wrap text-xs text-slate-700" dir="auto">{message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={whatsappLink(client.phone, message)}
              target="_blank"
              rel="noreferrer"
              title="Opens WhatsApp with this message as a draft — you tap send"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36h.55c.18 0 .41-.03.64.49.24.53.8 1.83.87 1.96.07.13.12.29.02.47-.1.19-.15.3-.29.46-.14.16-.3.36-.43.48-.14.13-.29.28-.13.55.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.32 1.44.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/>
              </svg>
              Send on WhatsApp
            </a>
            <button
              onClick={generate}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              ↻ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientsManager({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, company }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setName("");
      setPhone("");
      setCompany("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="grid gap-2.5 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          required
          dir="auto"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp number (e.g. +9665…)"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company (optional)"
          dir="auto"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="sm:col-span-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "…" : "Add client to CRM"}
        </button>
        {error && <p className="sm:col-span-3 text-xs text-rose-600">{error}</p>}
      </form>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No clients yet. Add one above, then tap “Thank you” to send an
          AI-written welcome over WhatsApp.
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}
