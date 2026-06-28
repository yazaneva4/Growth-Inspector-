import Link from "next/link";

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

const tiers = [
  {
    name: "Starter",
    who: "Solo professionals & creators",
    points: ["1–2 connected accounts", "Autonomous responder", "Per managed-account"],
  },
  {
    name: "Business",
    who: "SMEs & brands",
    points: ["More accounts + team seats", "Inspector reports & intent scoring", "Per account + per seat"],
    featured: true,
  },
  {
    name: "Agency",
    who: "Agencies managing clients",
    points: ["White-label & sub-workspaces", "Volume pricing", "Per account & per seat"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-bold tracking-tight">
          Growth<span className="text-emerald-400"> Inspector</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-300 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Dashboard
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <p className="mb-4 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Built for the Saudi growth space 🇸🇦
        </p>
        <h1 className="text-balance text-5xl font-bold leading-tight sm:text-6xl">
          The AI that answers your customers — in their own dialect.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-slate-300">
          Growth Inspector autonomously replies to your social DMs and comments
          in Arabic and English, around the clock, while acting as your
          always-on growth analyst.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Open the dashboard
          </Link>
          <Link
            href="/dashboard/inbox"
            className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800"
          >
            See the inbox
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <h3 className="text-lg font-semibold text-emerald-300">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-8 text-center text-3xl font-bold">Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl border p-6 ${
                t.featured
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              <h3 className="text-xl font-bold">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{t.who}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {t.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        Growth Inspector — autonomous social customer engagement for Saudi Arabia.
      </footer>
    </main>
  );
}
