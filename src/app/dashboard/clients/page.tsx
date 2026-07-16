import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { ClientsManager } from "@/components/clients-manager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  const { data: clients } =
    !ctx.isDemo && org
      ? await db
          .from("clients")
          .select("id, name, phone, company")
          .eq("org_id", org.id)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">Clients</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your client directory. Add someone, then tap “Thank you” to send them
        an AI-written welcome for joining GrowthSpace — straight to their
        WhatsApp.
      </p>

      {ctx.isDemo ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Sign in to manage your client directory.
        </p>
      ) : (
        <div className="mt-6">
          <ClientsManager clients={clients ?? []} />
        </div>
      )}
    </div>
  );
}
