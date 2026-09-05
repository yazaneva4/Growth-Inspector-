"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "error-callback": () => void;
        "expired-callback": () => void;
      }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type Mode = "signin" | "signup";
type LoginStep = "email" | "method" | "security";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
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
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState(rememberedEmail);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY) === "1",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [securityConfigured, setSecurityConfigured] = useState(false);

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

  useEffect(() => {
    if (step !== "method" || !turnstileReady || !turnstileSiteKey || !turnstileRef.current || !window.turnstile) {
      return;
    }

    if (turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current);
      return;
    }

    turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => {
        setTurnstileToken(token);
        setError(null);
      },
      "error-callback": () => {
        setTurnstileToken(null);
        setError("Bot verification could not be completed. Please try again.");
      },
      "expired-callback": () => {
        setTurnstileToken(null);
        setError("Bot verification expired. Please complete it again.");
      },
    });

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
      turnstileWidgetId.current = null;
      setTurnstileToken(null);
    };
  }, [step, turnstileReady]);

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
      return "This account still requires email confirmation. No verification code is used by Growth Inspector.";
    }
    if (/not found|user.*not.*exist/i.test(message) && mode === "signin") {
      return "No account was found for this email. Create an account first.";
    }
    if (/passkey_disabled/i.test(message)) {
      return "Passkey sign-in is not enabled for this Growth Inspector project yet.";
    }
    return message;
  }

  async function verifyTurnstile() {
    if (!turnstileSiteKey) {
      throw new Error("Bot verification is not configured yet. Please contact the site administrator.");
    }
    if (!turnstileToken) {
      throw new Error("Please complete the bot verification first.");
    }

    const response = await fetch("/api/auth/turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "cf-turnstile-response": turnstileToken }),
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setTurnstileToken(null);
    if (turnstileWidgetId.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId.current);
    }

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error ?? "Bot verification failed. Please try again.");
    }
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
      await verifyTurnstile();
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
    if (!passkeySupported) return false;
    const supabase = createClient();
    const { error: passkeyError } = await supabase.auth.registerPasskey();
    if (passkeyError) throw passkeyError;
    return true;
  }

  async function signInWithPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Enter your email address first.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    await verifyTurnstile();
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
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!normalizedEmail) throw new Error("Enter your email address first.");
    if (!trimmedName) throw new Error("Enter your name.");
    if (!trimmedPhone) throw new Error("Enter your phone number.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    await verifyTurnstile();

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${appOrigin()}/auth/callback?next=/dashboard/inbox`,
        data: {
          full_name: trimmedName,
          phone: trimmedPhone,
        },
      },
    });
    if (authError) throw authError;

    persistRememberedEmail();

    if (!data.session) {
      throw new Error("Account creation needs email confirmation in the current Supabase configuration. No verification code is used, but the confirmation link must be enabled before security setup can continue.");
    }

    setSecurityConfigured(false);
    setNotice("Account created. Now configure the secure sign-in methods available on this device.");
    setStep("security");
  }

  async function setupSecurity() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!passkeySupported) {
        setSecurityConfigured(false);
        setNotice("This device does not expose a web passkey authenticator. Your password is ready to use.");
        router.replace("/dashboard/inbox");
        router.refresh();
        return;
      }

      await registerPasskey();
      setSecurityConfigured(true);
      setNotice("Secure device sign-in is configured. Your biometric data and private authenticator key stay with the device; Growth Inspector receives only the authentication result.");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Security setup failed"));
    } finally {
      setBusy(false);
    }
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
    setMode("signin");
    setStep("method");
  }

  function startSignup() {
    clearMessages();
    setMode("signup");
    setStep("method");
  }

  function goBackToEmail() {
    clearMessages();
    setPassword("");
    setTurnstileToken(null);
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
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setTurnstileReady(true)}
      />
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center"><Logo variant="light" size={56} /></div>
        <div className="text-center">
          <h1 className="text-xl font-bold">
            {step === "security" ? "Secure your account" : mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "email"
              ? "Enter your email to continue"
              : step === "security"
                ? "Configure the secure sign-in methods available on this device"
                : mode === "signin"
                  ? "Choose how you want to sign in"
                  : "Add your name, phone, email, password, and bot verification"}
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
              onClick={startSignup}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Create account
            </button>
          </div>
        ) : step === "security" ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Account details</p>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="truncate font-medium">{email}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="truncate font-medium">{name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Phone</dt><dd className="truncate font-medium">{phone}</dd></div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold">Device security</p>
              <p className="mt-1 text-sm text-slate-500">
                Growth Inspector uses WebAuthn/passkeys. Your device may present Windows Hello, fingerprint, Touch ID, Face ID, or another supported biometric/device unlock automatically.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Growth Inspector does not receive or store your fingerprint, Face ID data, Windows Hello secret, or private authenticator key.
              </p>
            </div>

            {passkeySupported ? (
              <button
                type="button"
                onClick={setupSecurity}
                disabled={busy || securityConfigured}
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {securityConfigured ? "Device sign-in configured" : busy ? "Setting up secure sign-in…" : "Set up passkey / device unlock"}
              </button>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Passkeys are not available in this browser. Your password can still be used to sign in.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                router.replace("/dashboard/inbox");
                router.refresh();
              }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {securityConfigured ? "Continue to Growth Inspector" : "Skip for now"}
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
                  Use Windows Hello / fingerprint / biometric
                </button>

                <button
                  type="button"
                  onClick={signInWithPasskey}
                  disabled={busy || !passkeySupported}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use a passkey
                </button>

                <div className="flex justify-center pt-1">
                  <div ref={turnstileRef} className="cf-turnstile" />
                </div>
              </div>
            ) : (
              <form onSubmit={submitPassword} className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  autoComplete="tel"
                  inputMode="tel"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
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
                <div className="flex justify-center pt-1">
                  <div ref={turnstileRef} className="cf-turnstile" />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {busy ? "Creating account…" : "Create account"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  After creation, you will get a separate security setup page for passkey/device authentication.
                </p>
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
