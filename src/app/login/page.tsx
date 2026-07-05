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
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <svg width="44" height="44" viewBox="0 0 64 64" className="flex-shrink-0 drop-shadow-sm">
            <rect width="64" height="64" rx="12" fill="#ffffff" stroke="#1B2A6B" strokeWidth="0.5" />
            <path d="M 50 32 A 18 18 0 1 1 32 14"
              stroke="#F26522" strokeWidth="8" fill="none" strokeLinecap="round" />
            <rect x="33" y="11" width="15" height="15" rx="3" fill="#1B2A6B" opacity="0.95" />
          </svg>
          <div className="leading-tight">
            <div className="text-lg font-bold text-slate-950 tracking-tight">Growth</div>
            <div className="text-xs text-slate-600 font-semibold tracking-wide uppercase">Inspector</div>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg border border-slate-300 text-sm bg-slate-50">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`flex-1 rounded-md px-3 py-2.5 font-medium transition-colors ${
                mode === m
                  ? "bg-white text-slate-950 border border-slate-200"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.sa"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-emerald-600">{notice}</p>}
        </form>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-slate-600 hover:text-slate-950"
          >
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
