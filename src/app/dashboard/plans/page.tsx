import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { PlanCards } from "@/components/plan-cards";
import type { PlanTier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const ctx = await getCurrentContext();

  // Read the current plan for whichever workspace is in view.
  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("plan, name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  const currentPlan = (org?.plan as PlanTier | undefined) ?? null;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Plans</h1>
      <p className="mt-1 text-sm text-slate-400">
        {ctx.isDemo
          ? "Sign in to choose a plan for your workspace."
          : `Billing for ${org?.name ?? ctx.orgSlug}. Per managed-account + per-seat; white-label on Agency.`}
      </p>

      <div className="mt-6">
        <PlanCards currentPlan={currentPlan} canManage={!ctx.isDemo} />
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Prices in SAR, billed monthly (VAT added at checkout). Payment via
        Moyasar / Tap integrates at checkout — selecting a plan here updates your
        workspace tier today.
      </p>
    </div>
  );
}
