import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { CompetitorForm } from "@/components/competitor-form";

export const dynamic = "force-dynamic";

const badge: Record<string, string> = {
  instagram: "bg-pink-500/20 text-pink-700",
  x: "bg-slate-500/20 text-slate-800",
  tiktok: "bg-cyan-500/20 text-cyan-700",
  snapchat: "bg-yellow-500/20 text-yellow-700",
  whatsapp: "bg-green-500/20 text-green-700",
};

export default async function CompetitorsPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  let rows: Array<{ id: string; handle: string; platform: string; notes: string | null }> = [];
  if (org) {
    const { data } = await db
      .from("competitors")
      .select("id, handle, platform, notes")
      .eq("org_id", org.id)
      .order("created_at", { ascending: true });
    rows = data ?? [];
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Competitor watch</h1>
      <p className="mt-1 text-sm text-slate-500">
        Track competitors in your space and keep notes on how to win.
        {ctx.isDemo && <span className="text-amber-400"> Sign in to add your own.</span>}
      </p>

      {!ctx.isDemo && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <CompetitorForm />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            No competitors tracked yet.
          </div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${badge[c.platform] ?? "bg-slate-500/20 text-slate-600"}`}>
                  {c.platform}
                </span>
                <span className="font-medium" dir="auto">{c.handle}</span>
              </div>
              {c.notes && (
                <p className="mt-2 text-sm text-slate-500" dir="auto">{c.notes}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
