"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, planRank } from "@/lib/plans";
import type { PlanTier } from "@/lib/types";

export function PlanCards({
  currentPlan,
  canManage,
}: {
  currentPlan: PlanTier | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(tier: PlanTier) {
    if (!canManage) {
      router.push("/login");
      return;
    }
    setError(null);
    setBusy(tier);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.url) {
        // Redirect to the Moyasar hosted payment page.
        window.location.assign(data.url);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change plan");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = currentPlan === p.tier;
          const isDowngrade =
            currentPlan != null && planRank[p.tier] < planRank[currentPlan];
          return (
            <div
              key={p.tier}
              className={`flex flex-col rounded-2xl border p-6 ${
                p.featured
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{p.name}</h3>
                {isCurrent && (
                  <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-xs text-emerald-300">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-400">{p.tagline}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">
                  {p.price.toLocaleString()} SAR
                </span>
                <span className="text-sm text-slate-400"> / month</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-300">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choose(p.tier)}
                disabled={isCurrent || busy !== null}
                className={`mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                  p.featured
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    : "border border-slate-700 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {busy === p.tier
                  ? "…"
                  : isCurrent
                    ? "Your plan"
                    : !canManage
                      ? "Sign in to choose"
                      : isDowngrade
                        ? "Switch to this plan"
                        : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
