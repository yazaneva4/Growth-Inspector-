import Link from "next/link";
import { Logo } from "@/components/logo";

const features = [
  {
    title: "Native Saudi dialect",
    body: "Understands and replies in Khaleeji/Najdi, Arabizi, MSA and English — in the same register your customer wrote in.",
  },
  {
    title: "Autonomous, with guardrails",
    body: "Answers DMs and comments 24/7. Low-confidence or sensitive messages escalate to a human automatically.",
  },
  {
    title: "The Growth Inspector",
    body: "Always-on analyst: intent scoring, sentiment, lead scoring, and weekly growth insight reports.",
  },
  {
    title: "Every channel",
    body: "WhatsApp & Instagram first, then X, Snapchat and TikTok — one unified inbox.",
  },
];


export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <Logo variant="light" />
          <nav className="flex items-center gap-3 text-sm font-medium sm:gap-6">
            <Link
              href="/careers"
              className="hidden text-slate-700 hover:text-slate-950 sm:inline"
            >
              Careers
            </Link>
            <Link href="/login" className="text-slate-700 hover:text-slate-950">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-emerald-500 px-3 py-2 text-white hover:bg-emerald-600 sm:px-5"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-balance text-5xl font-bold leading-tight text-slate-950 sm:text-6xl">
          The AI that answers your customers — in their own dialect.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-slate-600">
          Growth Space autonomously replies to your social DMs and comments
          in Arabic and English, around the clock, while acting as your
          always-on growth analyst.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-500 px-8 py-3.5 font-semibold text-white hover:bg-emerald-600"
          >
            Open the dashboard
          </Link>
          <Link
            href="/dashboard/inbox"
            className="rounded-lg border border-slate-300 px-8 py-3.5 font-semibold text-slate-950 hover:bg-slate-50"
          >
            See the inbox
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-950">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-600">
        <Link href="/careers" className="text-slate-700 hover:text-slate-950">
          Careers — work in the Saudi growth space →
        </Link>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <Link href="/terms" className="text-slate-500 hover:text-slate-950">
            Terms of Service
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/privacy" className="text-slate-500 hover:text-slate-950">
            Privacy Policy
          </Link>
        </div>
        <div className="mt-3 text-slate-500">
          Growth Space — autonomous social customer engagement for Saudi Arabia.
        </div>
      </footer>
    </main>
  );
}
