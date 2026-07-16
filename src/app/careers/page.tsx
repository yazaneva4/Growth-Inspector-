"use client";

import { useState } from "react";
import Link from "next/link";

const ROLES = [
  "Social media manager",
  "Arabic content specialist",
  "Customer support / community",
  "Growth / performance marketer",
  "Engineering",
  "Other",
];

export default function CareersPage() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role_interest: ROLES[0],
    message: "",
  });

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-lg font-bold">
          Growth<span className="text-emerald-400"> Inspector</span>
        </Link>
        <h1 className="mt-8 font-serif text-4xl font-semibold">Work in the Saudi growth space 🇸🇦</h1>
        <p className="mt-3 text-slate-600">
          We&apos;re building the AI that powers customer engagement for Saudi
          brands. If you live and breathe social, Arabic content, or growth —
          tell us about yourself.
        </p>

        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6">
            <p className="font-medium text-emerald-300">
              Thank you! Your application is in. 🎉
            </p>
            <p className="mt-1 text-sm text-slate-600">
              We&apos;ll reach out by email if there&apos;s a fit.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-6"
          >
            <input
              required
              value={form.full_name}
              onChange={set("full_name")}
              placeholder="Full name"
              dir="auto"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="Email"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              value={form.phone}
              onChange={set("phone")}
              placeholder="Phone (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <select
              value={form.role_interest}
              onChange={set("role_interest")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <textarea
              rows={4}
              value={form.message}
              onChange={set("message")}
              placeholder="Tell us about yourself (Arabic or English)"
              dir="auto"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Apply"}
            </button>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
