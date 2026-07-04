"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Line {
  description: string;
  qty: string;
  unit_price: string;
}

const emptyLine = (): Line => ({ description: "", qty: "1", unit_price: "" });

export function InvoiceForm() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((s, l) => {
    const q = Number(l.qty);
    const p = Number(l.unit_price);
    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          items: lines.map((l) => ({
            description: l.description,
            qty: Number(l.qty),
            unit_price: Number(l.unit_price),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg(
        data.delivered
          ? `Invoice ${data.invoice.number} emailed to ${customerEmail} ✓`
          : `Invoice ${data.invoice.number} saved as draft (add RESEND_API_KEY to actually email it).`,
      );
      setCustomerName("");
      setCustomerEmail("");
      setLines([emptyLine()]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Customer name · اسم العميل"
          dir="auto"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <input
          required
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="customer@email.com"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input
            required
            value={l.description}
            onChange={(e) => setLine(i, { description: e.target.value })}
            placeholder="Description · الوصف"
            dir="auto"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <input
            required
            type="number"
            min="1"
            value={l.qty}
            onChange={(e) => setLine(i, { qty: e.target.value })}
            placeholder="Qty"
            className="w-20 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={l.unit_price}
            onChange={(e) => setLine(i, { unit_price: e.target.value })}
            placeholder="Price (SAR)"
            className="w-32 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
              className="rounded-xl border border-slate-700 px-3 text-slate-400 hover:bg-slate-800"
              aria-label="Remove line"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLines((ls) => [...ls, emptyLine()])}
        className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
      >
        + Add line
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 text-sm">
        <div className="text-slate-400">
          Subtotal {fmt(subtotal)} · VAT 15% {fmt(vat)} ·{" "}
          <span className="font-semibold text-emerald-400">Total {fmt(total)} SAR</span>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Create & email invoice"}
        </button>
      </div>

      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  );
}
