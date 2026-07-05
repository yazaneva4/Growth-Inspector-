import Link from "next/link";
import { getAnalytics } from "@/lib/analytics";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sparkline, LineChart } from "@/components/dashboard-visuals";

export const dynamic = "force-dynamic";

const platformBadge: Record<string, { label: string; cls: string }> = {
  whatsapp: { label: "WA", cls: "bg-green-500/20 text-green-700" },
  instagram: { label: "IG", cls: "bg-pink-500/20 text-pink-700" },
  x: { label: "X", cls: "bg-slate-500/20 text-slate-800" },
  snapchat: { label: "SC", cls: "bg-yellow-500/20 text-yellow-700" },
  tiktok: { label: "TT", cls: "bg-cyan-500/20 text-cyan-700" },
  email: { label: "@", cls: "bg-sky-500/20 text-sky-700" },
  call: { label: "📞", cls: "bg-violet-500/20 text-violet-700" },
  sandbox: { label: "•", cls: "bg-slate-500/20 text-slate-600" },
};

const advantages = [
  { t: "Native Saudi dialect", d: "Khaleeji, Najdi, Arabizi & English in the same register." },
  { t: "Autonomous, with guardrails", d: "Answers 24/7; low-confidence escalates to a human." },
  { t: "Always-on analyst", d: "Intent scoring, sentiment & weekly growth reports." },
  { t: "Every channel, one inbox", d: "WhatsApp, Instagram, X, Snapchat, TikTok, email & voice calls." },
];

export default async function DashboardOverview() {
  const ctx = await getCurrentContext();
  const client = ctx.isDemo ? undefined : await createClient();
  const a = await getAnalytics(7, ctx.orgSlug, client);

  if (!a) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-2 text-sm text-slate-500">No workspace data found.</p>
      </div>
    );
  }

  const name = ctx.email ? ctx.email.split("@")[0] : "there";
  const vol = a.volumeByDay.map((v) => v.count);
  const cards = [
    { label: "Conversations", value: a.totals.conversations, color: "#34d399", series: vol },
    { label: "Auto-resolved", value: `${(a.totals.autoResolutionRate * 100).toFixed(0)}%`, sub: `${a.totals.aiReplies} AI replies`, color: "#38bdf8", series: vol.map((v) => Math.round(v * 0.8)) },
    { label: "Escalated to human", value: a.totals.escalations, color: "#fb7185", series: vol.map((v) => Math.max(0, Math.round(v * 0.25))) },
    { label: "Hot leads", value: a.totals.hotLeads, color: "#a78bfa", series: vol.map((v) => Math.round(v * 0.5)) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {ctx.email ? `Welcome back, ${name}` : "Welcome"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s your growth overview for {a.orgName} · Last {a.rangeDays} days
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/analytics"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            📈 View full report
          </Link>
          <Link
            href="/dashboard/inbox"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Open Inbox
            <span className="rounded-md bg-white/20 px-1.5 text-xs">
              {a.totals.conversations}
            </span>
          </Link>
        </div>
      </div>

      {/* Stat cards + live inbox card */}
      <div className="grid gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-sm text-slate-500">{c.label}</div>
            {c.sub && <div className="text-xs text-emerald-400">{c.sub}</div>}
            <Sparkline series={c.series} color={c.color} className="mt-3" />
          </div>
        ))}

        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-slate-50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Inbox · Live</span>
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Autonomous
            </span>
          </div>
          <p className="mt-4 text-center text-xs text-slate-600">
            ✨ Monitoring your channels 24/7
            <br />
            Replying in Arabic & English
          </p>
          <div className="mt-4 flex justify-center gap-2 text-xs">
            {(["whatsapp", "instagram", "x", "snapchat", "tiktok", "email", "call"] as const).map(
              (p) => (
                <span
                  key={p}
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${platformBadge[p].cls}`}
                >
                  {platformBadge[p].label}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Intent + Sentiment */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Intent breakdown">
          <div className="space-y-2">
            {a.intents.map((it, i) => {
              const max = Math.max(...a.intents.map((x) => x.count), 1);
              const colors = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500"];
              return (
                <div key={it.intent} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-600">{it.intent}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${(it.count / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-slate-500">{it.count}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Sentiment">
          <SentimentBar {...a.sentiment} />
          <h3 className="mb-2 mt-6 text-xs font-semibold text-slate-500">Languages / dialects</h3>
          <div className="space-y-2">
            {a.languages.map((l, i) => {
              const max = Math.max(...a.languages.map((x) => x.count), 1);
              const colors = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500"];
              return (
                <div key={l.language} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-slate-600">{l.language}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${(l.count / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-slate-500">{l.count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Volume + leads + escalations */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Conversation volume by day">
          <LineChart data={a.volumeByDay.map((v) => ({ label: v.day.slice(5), value: v.count }))} />
        </Panel>

        <Panel title="Top leads to follow up">
          <div className="space-y-1">
            {a.topLeads.map((l) => (
              <div key={l.handle} className="flex items-center justify-between border-b border-slate-200 py-2 text-sm last:border-0">
                <span className="truncate" dir="auto">{l.customer}</span>
                <span className="ml-2 shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
                  {l.lead_score}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`Escalations · ${a.totals.escalations}`}>
          <div className="space-y-2">
            {a.escalationsList.length === 0 && (
              <p className="text-sm text-slate-500">None right now 🎉</p>
            )}
            {a.escalationsList.map((e, i) => (
              <div key={i} className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm" dir="auto">{e.customer}</span>
                  <span className="ml-2 shrink-0 rounded-full border border-rose-500/40 px-2 py-0.5 text-[10px] text-rose-600">
                    {e.reason.replace(/_/g, " ")}
                  </span>
                </div>
                {e.draft && (
                  <p className="mt-1 truncate text-xs text-slate-500" dir="auto">
                    {e.draft}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Advantage strip */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-sky-700">The Growth Inspector advantage</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map((x) => (
            <div key={x.t}>
              <h3 className="text-sm font-semibold">{x.t}</h3>
              <p className="mt-1 text-xs text-slate-500">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-emerald-500">{title}</h2>
      {children}
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = Math.max(1, positive + neutral + negative);
  const seg = [
    { v: positive, c: "bg-emerald-500", label: "positive" },
    { v: neutral, c: "bg-slate-500", label: "neutral" },
    { v: negative, c: "bg-rose-500", label: "negative" },
  ];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {seg.map((s) => (
          <div key={s.label} className={s.c} style={{ width: `${(s.v / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        {seg.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${s.c}`} />
            {s.label} {s.v}
          </span>
        ))}
      </div>
    </div>
  );
}
