const stats = [
  { label: "Conversations today", value: "—" },
  { label: "Auto-resolved", value: "—" },
  { label: "Escalated to human", value: "—" },
  { label: "Hot leads", value: "—" },
];

export default function DashboardOverview() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-slate-400">
        Live stats appear here once your Supabase project and connected accounts
        are wired up. Try the responder now from the{" "}
        <a href="/dashboard/inbox" className="text-emerald-400 underline">
          Inbox
        </a>
        .
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="mt-1 text-sm text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="font-semibold text-emerald-300">Growth Inspector report</h2>
        <p className="mt-2 text-sm text-slate-400">
          The weekly AI analyst (Phase 2) will summarise engagement, sentiment
          trends, and growth opportunities across your managed accounts here.
        </p>
      </div>
    </div>
  );
}
