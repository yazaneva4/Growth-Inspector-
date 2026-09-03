"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

type Mode = "signin" | "signup";
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
const REMEMBER_KEY = "gi_remember_me";
const REMEMBERED_EMAIL_KEY = "gi_remembered_email";
const PRODUCTION_APP_URL = "https://growth-inspector-zl9k.vercel.app";

function appOrigin() { if (typeof window === "undefined") return PRODUCTION_APP_URL; return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? PRODUCTION_APP_URL : window.location.origin; }
function rememberedEmail(): string { if (typeof window === "undefined") return ""; return localStorage.getItem(REMEMBER_KEY) === "1" ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "") : ""; }

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(rememberedEmail);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { if (codeSent) (document.getElementById("growth-ai-code") as HTMLInputElement | null)?.focus(); }, [codeSent]);
  function persistRememberedEmail() { if (rememberMe) { localStorage.setItem(REMEMBER_KEY, "1"); localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim()); } else { localStorage.removeItem(REMEMBER_KEY); localStorage.removeItem(REMEMBERED_EMAIL_KEY); } }
  function friendlyError(message: string) { if (/rate limit/i.test(message)) return "Too many attempts right now — please wait a minute and try again."; if (/invalid.*otp|otp.*expired|token.*expired/i.test(message)) return "That code is invalid or expired. Request a new code and try again."; if (/not found|user.*not.*exist/i.test(message) && mode === "signin") return "No account was found for this email. Create an account first."; return message; }

  async function signInWithGoogle() {
    setError(null); setBusy(true); const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${appOrigin()}/auth/callback?next=/dashboard/inbox` } });
    if (authError) { setBusy(false); setError(friendlyError(authError.message)); }
  }
  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase(); if (!normalizedEmail) throw new Error("Enter your email address first.");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: mode === "signup", emailRedirectTo: `${appOrigin()}/auth/callback?next=/dashboard/inbox` } });
    if (authError) throw authError;
    setCodeSent(true); setNotice(`Growth Inspector sent a 6-digit sign-in code to ${normalizedEmail}.`);
  }
  async function verifyCode() {
    const normalizedEmail = email.trim().toLowerCase(); if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the 6-digit code from Growth Inspector.");
    const supabase = createClient(); const { error: authError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code.trim(), type: "email" });
    if (authError) throw authError; persistRememberedEmail(); router.replace("/dashboard/inbox"); router.refresh();
  }
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(null); setNotice(null); setBusy(true); try { if (codeSent) await verifyCode(); else await requestCode(); } catch (err) { setError(friendlyError(err instanceof Error ? err.message : "Authentication failed")); } finally { setBusy(false); } }

  return <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950"><div className="w-full max-w-sm space-y-8">
    <div className="flex justify-center"><Logo variant="light" size={56} /></div>
    <div className="text-center"><h1 className="text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1><p className="mt-1 text-sm text-slate-500">{codeSent ? "Enter the 6-digit Growth Inspector code" : "Sign in securely with a Growth Inspector email code"}</p></div>
    {googleEnabled && !codeSent && <><button onClick={signInWithGoogle} disabled={busy} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Continue with Google</button><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or with email<span className="h-px flex-1 bg-slate-200" /></div></>}
    {!codeSent && <div className="flex rounded-lg border border-slate-300 bg-slate-50 text-sm">{(["signin", "signup"] as const).map((m) => <button key={m} type="button" onClick={() => { setMode(m); setError(null); setNotice(null); }} className={`flex-1 rounded-md px-3 py-2.5 font-medium ${mode === m ? "border border-slate-200 bg-white text-slate-950" : "text-slate-600"}`}>{m === "signin" ? "Sign in" : "Create account"}</button>)}</div>}
    <form onSubmit={submit} className="space-y-4"><input type="email" required disabled={codeSent} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.sa" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50" />
      {codeSent && <input id="growth-ai-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />}
      {!codeSent && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-500" />Remember me</label>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? "…" : codeSent ? "Verify code" : "Send code"}</button>
      {codeSent && <button type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setNotice(null); setError(null); }} className="w-full text-xs text-slate-500 hover:text-slate-900">Use a different email</button>}
      {error && <p className="text-xs text-red-600">{error}</p>}{notice && <p className="text-xs text-emerald-600">{notice}</p>}
    </form>
    <Link href="/dashboard/inbox" className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">Continue as guest</Link>
    <div className="space-y-2 text-center"><Link href="/" className="block text-xs text-slate-600 hover:text-slate-950">← Back home</Link><p className="text-[11px] text-slate-400">By continuing, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p></div>
  </div></main>;
}
