import { getAnalytics } from "@/lib/analytics";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateGrowthReport } from "@/lib/ai/report";
import { Panel, BarList, SentimentBar, StatCard } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await getCurrentContext();
  const client = ctx.isDemo ? undefined : await createClient();
  const a = await getAnalytics(7, ctx.orgSlug, client);
  if (!a) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Growth Inspector report</h1>
        <p className="mt-2 text-sm text-slate-500">No data available.</p>
      </div>
    );
  }
  const report = await generateGrowthReport(a);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Growth Inspector report</h1>
          <p className="mt-1 text-sm text-slate-500">
            {a.orgName} · weekly analyst · last {a.rangeDays} days
          </p>
        </div>
        <a
          href="/api/export"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          ⬇ Export CSV
        </a>
      </div>

      {/* AI narrative report */}
      <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          🔎 The Inspector says
        </div>
        <p className="mt-2 text-lg font-medium text-slate-900">
          {report.headline}
        </p>

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <ReportColumn title="Highlights" items={report.highlights} accent="text-emerald-500" />
          <ReportColumn title="Watch out" items={report.concerns} accent="text-amber-700" />
          <ReportColumn title="Recommended actions" items={report.recommendations} accent="text-sky-700" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversations" value={a.totals.conversations} />
        <StatCard label="AI replies" value={a.totals.aiReplies} />
        <StatCard
          label="Auto-resolution"
          value={`${(a.totals.autoResolutionRate * 100).toFixed(0)}%`}
        />
        <StatCard label="Hot leads" value={a.totals.hotLeads} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Intent breakdown">
          <BarList items={a.intents.map((i) => ({ label: i.intent, value: i.count }))} />
        </Panel>
        <Panel title="Sentiment & languages">
          <SentimentBar {...a.sentiment} />
          <div className="mt-6">
            <BarList
              items={a.languages.map((l) => ({ label: l.language, value: l.count }))}
            />
          </div>
        </Panel>
        <Panel title="Conversation volume by day">
          <BarList
            items={a.volumeByDay.map((v) => ({ label: v.day.slice(5), value: v.count }))}
          />
        </Panel>
        <Panel title="Top leads to follow up">
          <table className="w-full text-sm">
            <tbody>
              {a.topLeads.map((l) => (
                <tr key={l.handle} className="border-b border-slate-200 last:border-0">
                  <td className="py-2" dir="auto">{l.customer}</td>
                  <td className="py-2 text-slate-500">{l.intent ?? "—"}</td>
                  <td className="py-2 text-right font-semibold text-emerald-500">
                    {l.lead_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function ReportColumn({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {title}
      </h3>
      <ul className="mt-2 space-y-2 text-sm text-slate-600">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={accent}>•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
