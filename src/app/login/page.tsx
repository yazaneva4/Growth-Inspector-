"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function friendlyError(message: string): string {
    if (/rate limit/i.test(message)) {
      return "Too many attempts right now — please wait a minute and try again.";
    }
    if (/already.*registered|already.*exists/i.test(message)) {
      return "An account with this email already exists — sign in instead.";
    }
    return message;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (signupData.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your email for a confirmation link, then sign in.",
          );
          setMode("signin");
        }
      } else {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && /email not confirmed/i.test(error.message)) {
          // Self-heal any account stuck unconfirmed, then retry once.
          await fetch("/api/auth/force-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          }).catch(() => {});
          ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        }
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Authentication failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-xl font-bold">
          Growth<span className="text-emerald-400"> Inspector</span>
        </h1>

        <div className="mt-6 flex rounded-lg border border-slate-700 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md px-3 py-2 ${
                mode === m ? "bg-emerald-500 text-slate-950" : "text-slate-300"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.sa"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}
        </form>

        <Link
          href="/"
          className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
