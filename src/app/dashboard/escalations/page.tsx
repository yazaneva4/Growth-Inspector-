import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EscalationsPage() {
  const db = createPublicClient();
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", "demo")
    .maybeSingle();

  const { data: rows } = org
    ? await db
        .from("escalations")
        .select(
          "id, reason, draft, resolved, created_at, conversations(customer_name, customer_handle, platform, language, lead_score)",
        )
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const escalations = rows ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Escalations</h1>
      <p className="mt-1 text-sm text-slate-400">
        Conversations the AI handed to a human — low confidence, high-intent
        leads, or hard-block topics (politics, religion, legal/medical, pricing
        commitments). These never auto-send.
      </p>

      {escalations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">
          No open escalations 🎉
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {escalations.map((e) => {
            const c = (e.conversations ?? {}) as {
              customer_name?: string;
              customer_handle?: string;
              platform?: string;
              language?: string;
            };
            return (
              <div
                key={e.id}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium" dir="auto">
                    {c.customer_name ?? c.customer_handle ?? "Customer"}
                    <span className="ml-2 text-xs text-slate-500">
                      {c.platform} · {c.language}
                    </span>
                  </div>
                  <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-xs text-rose-300">
                    {e.reason.replace(/_/g, " ")}
                  </span>
                </div>
                {e.draft && (
                  <p
                    className="mt-3 rounded-lg bg-slate-800/60 p-3 text-sm text-slate-300"
                    dir="auto"
                  >
                    Suggested draft: {e.draft}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
