"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

type Mode = "signin" | "signup";

// ?new=1 (from "Create another account") opens straight on the signup tab.
function initialMode(): Mode {
  if (typeof window !== "undefined") {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      return "signup";
    }
  }
  return "signin";
}

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard/inbox` },
    });
    if (error) {
      setBusy(false);
      if (/provider is not enabled/i.test(error.message)) {
        setError(
          "Google sign-in isn't enabled yet. Add Google in Supabase → Authentication → Providers, or use email below.",
        );
      } else {
        setError(error.message);
      }
    }
    // On success the browser redirects to Google — no need to reset busy.
  }

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
          // Email confirmation is off in Supabase → straight into the app.
          router.push("/dashboard/inbox");
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
        router.push("/dashboard/inbox");
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
        <div className="flex justify-center">
          <Logo variant="light" size={44} />
        </div>

        {/* Greeting */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-950">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "signin"
              ? "Sign in to your Growth Inspector workspace"
              : "Start your Growth Inspector workspace"}
          </p>
        </div>

        {/* Google sign-in — only shown once the provider is actually enabled
            (set NEXT_PUBLIC_GOOGLE_ENABLED=true after configuring Google in
            Supabase) so users never get sent to a broken authorize page. */}
        {googleEnabled && (
          <>
            <button
              onClick={signInWithGoogle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.5 44 31 44 24c0-1.2-.1-2.3-.4-3.5z" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

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

        {/* Guest login — get straight in with no account (demo workspace) */}
        <Link
          href="/dashboard/inbox"
          className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Continue as guest
        </Link>

        {/* Request access + back link */}
        <div className="space-y-2 text-center">
          <p className="text-xs text-slate-500">
            No account?{" "}
            <Link href="/request-access" className="text-emerald-500 hover:underline">
              Request access
            </Link>
          </p>
          <Link href="/" className="block text-xs text-slate-600 hover:text-slate-950">
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
