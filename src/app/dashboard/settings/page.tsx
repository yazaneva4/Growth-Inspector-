import { HARD_BLOCK_TOPICS } from "@/lib/ai/responder";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";
import type { BrandVoice, ReplyMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("brand_voice, reply_mode, confidence_threshold")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  const initial = {
    voice: (org?.brand_voice ?? {}) as BrandVoice,
    reply_mode: (org?.reply_mode as ReplyMode) ?? "approval",
    confidence_threshold: Number(org?.confidence_threshold ?? 0.75),
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Brand voice</h1>
      <p className="mt-1 text-sm text-slate-500">
        This is how Growth Inspector speaks for you. It feeds directly into the
        responder — changes apply to new replies immediately.
        {ctx.isDemo && (
          <span className="text-amber-400"> Sign in to edit your workspace.</span>
        )}
      </p>

      <div className="mt-6">
        <SettingsForm initial={initial} canSave={!ctx.isDemo} />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-rose-600">
          Always escalated to a human
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          These are hard-coded guardrails — the AI never handles them on its own.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-500">
          {HARD_BLOCK_TOPICS.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
