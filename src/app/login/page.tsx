"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/dashboard` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(
        "Could not send magic link. Make sure Supabase env vars are set.",
      );
      console.error(err);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-xl font-bold">
          Growth<span className="text-emerald-400"> Inspector</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign in with a magic link.
        </p>
        {sent ? (
          <p className="mt-6 rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Check your inbox — we sent a sign-in link to {email}.
          </p>
        ) : (
          <form onSubmit={signIn} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.sa"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Send magic link
            </button>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </form>
        )}
        <a
          href="/dashboard"
          className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-300"
        >
          Skip to dashboard (demo)
        </a>
      </div>
    </main>
  );
}
