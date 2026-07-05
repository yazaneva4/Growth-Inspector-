"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo variant="light" size={44} />
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold">Request sent</h1>
            <p className="text-sm text-slate-500">
              The workspace owner has been notified. Once they approve, you&apos;ll
              get an email to set your password and sign in.
            </p>
            <Link href="/" className="inline-block text-xs text-slate-600 hover:text-slate-950">
              ← Back home
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-xl font-bold">Request access</h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter your name and email. The workspace owner approves you, then
                you can sign in.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                dir="auto"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.sa"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {busy ? "Sending…" : "Request access"}
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>

            <div className="text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-emerald-500 hover:underline">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
