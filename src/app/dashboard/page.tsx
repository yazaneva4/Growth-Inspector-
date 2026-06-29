import { getAnalytics } from "@/lib/analytics";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatCard, Panel, BarList, SentimentBar } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const ctx = await getCurrentContext();
  const client = ctx.isDemo ? undefined : await createClient();
  const a = await getAnalytics(7, ctx.orgSlug, client);

  if (!a) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-2 text-sm text-slate-400">
          No workspace data found. Check the Supabase connection.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            {a.orgName} · last {a.rangeDays} days
          </p>
        </div>
        <a
          href="/dashboard/analytics"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          View full report →
        </a>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversations" value={a.totals.conversations} />
        <StatCard
          label="Auto-resolved"
          value={`${(a.totals.autoResolutionRate * 100).toFixed(0)}%`}
          sub={`${a.totals.aiReplies} AI replies`}
        />
        <StatCard label="Escalated to human" value={a.totals.escalations} />
        <StatCard label="Hot leads" value={a.totals.hotLeads} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Intent breakdown">
          <BarList
            items={a.intents.map((i) => ({ label: i.intent, value: i.count }))}
          />
        </Panel>
        <Panel title="Sentiment">
          <SentimentBar {...a.sentiment} />
          <h3 className="mb-2 mt-6 text-xs font-semibold text-slate-400">
            Languages / dialects
          </h3>
          <BarList
            items={a.languages.map((l) => ({
              label: l.language,
              value: l.count,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
