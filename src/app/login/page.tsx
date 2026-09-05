"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

type Mode = "signin" | "signup";

type LoginStep = "email" | "method";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
const REMEMBER_KEY = "gi_remember_me";
const REMEMBERED_EMAIL_KEY = "gi_remembered_email";
const PRODUCTION_APP_URL = "https://growth-inspector-yazaneva4-3470s-projects.vercel.app";

function appOrigin() {
  if (typeof window === "undefined") return PRODUCTION_APP_URL;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? PRODUCTION_APP_URL
    : window.location.origin;
}

function rememberedEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REMEMBER_KEY) === "1"
    ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "")
    : "";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY) === "1",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    const invitedEmail = new URLSearchParams(window.location.search).get("email");
    if (invitedEmail && !email) setEmail(invitedEmail.toLowerCase());
  }, [email]);

  useEffect(() => {
    setPasskeySupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator.credentials?.get === "function",
    );
  }, []);

  function persistRememberedEmail() {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, "1");
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  }

  function friendlyError(message: string) {
    if (/rate limit/i.test(message)) return "Too many attempts right now — please try again in a minute.";
    if (/invalid.*password|invalid login credentials|email or password/i.test(message)) {
      return "The email or password is incorrect.";
    }
    if (/email_not_confirmed|confirm.*email/i.test(message)) {
      return "Please confirm your email address, then sign in with your password.";
    }
    if (/not found|user.*not.*exist/i.test(message) && mode === "signin") {
      return "No account was found for this email. Create an account first.";
    }
    if (/passkey_disabled/i.test(message)) {
      return "Passkey sign-in is not enabled for this Growth Inspector project yet.";
    }
    return message;
  }

  async function signInWithGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appOrigin()}/auth/callback?next=/dashboard/inbox` },
    });
    if (authError) {
      setBusy(false);
      setError(friendlyError(authError.message));
    }
  }

  async function signInWithPasskey() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!passkeySupported) {
        throw new Error("This browser does not support passkeys. You can still sign in with your password.");
      }
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPasskey();
      if (authError) throw authError;
      persistRememberedEmail();
      if (data.user?.email) setEmail(data.user.email);
      router.replace("/dashboard/inbox");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Passkey sign-in failed"));
      setBusy(false);
    }
  }

  async function registerPasskey() {
    if (!passkeySupported) return;
    const supabase = createClient();
    const { error: passkeyError } = await supabase.auth.registerPasskey();
    if (passkeyError) throw passkeyError;
  }

  async function signInWithPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Enter your email address first.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (authError) throw authError;

    persistRememberedEmail();
    router.replace("/dashboard/inbox");
    router.refresh();
  }

  async function signUp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Enter your email address first.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback?next=/dashboard/inbox` },
    });
    if (authError) throw authError;

    persistRememberedEmail();

    if (data.session) {
      try {
        await registerPasskey();
        setNotice("Account created. Windows Hello or fingerprint is now set up for this device.");
      } catch (passkeyError) {
        setNotice(
          `Account created. Passkey setup was skipped: ${passkeyError instanceof Error ? passkeyError.message : "not available"}. You can use your password.`
        );
      }
      router.replace("/dashboard/inbox");
      router.refresh();
      return;
    }

    setNotice("Account created. Check your email for the secure confirmation link, then sign in with your password.");
  }

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  function continueWithEmail() {
    clearMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address first.");
      return;
    }
    setEmail(normalizedEmail);
    setStep("method");
  }

  function goBackToEmail() {
    clearMessages();
    setPassword("");
    setStep("email");
  }

  async function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      if (mode === "signin") await signInWithPassword();
      else await signUp();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Authentication failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center"><Logo variant="light" size={56} /></div>
        <div className="text-center">
          <h1 className="text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "email"
              ? "Enter your email to continue"
              : mode === "signin"
                ? "Choose how you want to sign in"
                : "Finish creating your account with a password"}
          </p>
        </div>

        {googleEnabled && step === "email" && (
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Continue with Google
          </button>
        )}

        {step === "email" ? (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                continueWithEmail();
              }}
              className="space-y-4"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.sa"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                Continue
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                clearMessages();
                setMode("signup");
                setStep("method");
              }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Create account
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={goBackToEmail}
              disabled={busy}
              className="flex w-full items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-950 disabled:opacity-50"
            >
              <span aria-hidden="true">←</span>
              <span className="truncate">{email}</span>
              <span className="ml-auto shrink-0 underline">Change</span>
            </button>

            {mode === "signin" ? (
              <div className="space-y-3">
                <form onSubmit={submitPassword} className="space-y-3">
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                    />
                    Remember me
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {busy ? "Signing in…" : "Sign in with password"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={signInWithPasskey}
                  disabled={busy || !passkeySupported}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use Windows Hello / fingerprint
                </button>

                <button
                  type="button"
                  onClick={signInWithPasskey}
                  disabled={busy || !passkeySupported}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use a passkey
                </button>
              </div>
            ) : (
              <form onSubmit={submitPassword} className="space-y-4">
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                  />
                  Remember me
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {notice && <p className="text-xs text-emerald-600">{notice}</p>}

        {step === "email" && (
          <Link
            href="/dashboard/inbox"
            className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Continue as guest
          </Link>
        )}

        <div className="space-y-2 text-center">
          <Link href="/" className="block text-xs text-slate-600 hover:text-slate-950">← Back home</Link>
          <p className="text-[11px] text-slate-400">By continuing, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        </div>
      </div>
    </main>
  );
}
