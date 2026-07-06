import { headers } from "next/headers";
import { HARD_BLOCK_TOPICS } from "@/lib/ai/responder";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";
import { ConnectedAccounts } from "@/components/connected-accounts";
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

  let accounts: Array<{
    id: string;
    platform: string;
    external_id: string;
    display_name: string;
    is_active: boolean;
  }> = [];
  if (!ctx.isDemo) {
    const { data: orgRow } = await db
      .from("organizations")
      .select("id")
      .eq("slug", ctx.orgSlug)
      .maybeSingle();
    if (orgRow) {
      const { data } = await db
        .from("connected_accounts")
        .select("id, platform, external_id, display_name, is_active")
        .eq("org_id", orgRow.id)
        .eq("is_active", true)
        .in("platform", ["whatsapp", "instagram", "x", "snapchat", "tiktok"])
        .order("platform");
      accounts = data ?? [];
    }
  }
  const host = (await headers()).get("host");
  const webhookBase = `https://${host}/api/webhooks`;

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
        <h2 className="text-sm font-semibold text-slate-900">
          Connected social accounts
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Wire up a real WhatsApp Business, Instagram, or other business
          account so employee-handled conversations flow into this inbox for
          real, instead of the sandbox tester.
          {ctx.isDemo && (
            <span className="text-amber-600"> Sign in to connect accounts.</span>
          )}
        </p>
        {!ctx.isDemo && (
          <div className="mt-4">
            <ConnectedAccounts accounts={accounts} webhookBase={webhookBase} />
          </div>
        )}
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
