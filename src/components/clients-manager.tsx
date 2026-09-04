"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string; phone: string; company: string | null };

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
    setError(null); setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/clients/welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: client.name, company: client.company }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate");
      setMessage(data.message as string);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to generate"); }
    finally { setBusy(false); }
  }

  async function remove() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/clients", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: client.id }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to remove client");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to remove client"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-2"><div className="min-w-0"><span className="font-medium" dir="auto">{client.name}</span>{client.company && <span className="ml-2 text-slate-500" dir="auto">· {client.company}</span>}<span className="ml-2 text-slate-500">{client.phone}</span></div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={generate} disabled={busy} title="Generate an AI thank-you and send on WhatsApp" className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50">{busy ? "…" : "Thank you"}</button>
          <button onClick={remove} disabled={busy} className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50">Remove</button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {message && <div className="mt-2 rounded-lg bg-slate-50 p-3"><p className="whitespace-pre-wrap text-xs text-slate-700" dir="auto">{message}</p><div className="mt-2 flex flex-wrap items-center gap-2"><a href={whatsappLink(client.phone, message)} target="_blank" rel="noreferrer" title="Opens WhatsApp with this message as a draft" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">Send on WhatsApp</a><button onClick={generate} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">↻ Regenerate</button></div></div>}
    </div>
  );
}

export function ClientsManager({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, company }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add");
      setName(""); setPhone(""); setCompany(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to add"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <form onSubmit={submit} className="grid gap-2.5 sm:grid-cols-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" required dir="auto" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number (e.g. +9665…)" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" />
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" dir="auto" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" />
      <button type="submit" disabled={busy} className="sm:col-span-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? "…" : "Add client to CRM"}</button>
      {error && <p className="sm:col-span-3 text-xs text-rose-600">{error}</p>}
    </form>
    {clients.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No clients yet. Add one above, then tap “Thank you” to send an AI-written welcome over WhatsApp.</p> : <div className="space-y-2">{clients.map((c) => <ClientRow key={c.id} client={c} />)}</div>}
  </div>;
}
