import { getAnalytics } from "@/lib/analytics";
import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateTrendRadar } from "@/lib/ai/trends";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const ctx = await getCurrentContext();
  const client = ctx.isDemo ? undefined : await createClient();
  const a = await getAnalytics(7, ctx.orgSlug, client);

  if (!a) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Trend radar</h1>
        <p className="mt-2 text-sm text-slate-400">No data available.</p>
      </div>
    );
  }

  const radar = await generateTrendRadar(a);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Trend radar</h1>
      <p className="mt-1 text-sm text-slate-400">
        {a.orgName} · what your customers are talking about · last {a.rangeDays} days
      </p>

      <div className="mt-6 rounded-2xl border border-sky-500/40 bg-sky-500/5 p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          📡 Trending now
        </div>
        <p className="mt-2 text-lg font-medium">{radar.headline}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {radar.themes.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <h3 className="text-base font-semibold text-emerald-300" dir="auto">
              {t.topic}
            </h3>
            <p className="mt-2 text-sm text-slate-400" dir="auto">
              {t.why}
            </p>
            <div className="mt-3 rounded-lg bg-slate-800/60 p-3 text-sm text-slate-200" dir="auto">
              <span className="text-emerald-400">▶ </span>
              {t.action}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">
          Suggested hashtags
        </h2>
        <div className="flex flex-wrap gap-2">
          {radar.hashtags.map((h) => (
            <span
              key={h}
              dir="auto"
              className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-sm text-sky-300"
            >
              {h}
            </span>
          ))}
        </div>
      </div>

      {!process.env.ANTHROPIC_API_KEY && (
        <p className="mt-4 text-xs text-amber-400">
          Add ANTHROPIC_API_KEY to unlock the full AI-written trend analysis.
        </p>
      )}
    </div>
  );
}
