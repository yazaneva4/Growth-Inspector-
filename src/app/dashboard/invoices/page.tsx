import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";
import { MarkPaidButton } from "@/components/mark-paid-button";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  sent: "border-sky-500/40 text-sky-700",
  paid: "border-emerald-500/40 text-emerald-500",
  draft: "border-amber-500/40 text-amber-700",
};

export default async function InvoicesPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  let invoices: Array<{
    id: string;
    number: string;
    customer_name: string;
    customer_email: string;
    total: number;
    currency: string;
    status: string;
    created_at: string;
  }> = [];
  if (org) {
    const { data } = await db
      .from("invoices")
      .select("id, number, customer_name, customer_email, total, currency, status, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(100);
    invoices = data ?? [];
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Invoices</h1>
      <p className="mt-1 text-sm text-slate-500">
        Create an invoice (SAR + 15% VAT) and email it to your customer — the
        list below updates live.
        {ctx.isDemo && <span className="text-amber-400"> Sign in to create invoices.</span>}
      </p>

      {!ctx.isDemo && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <InvoiceForm />
        </div>
      )}

      <div className="mt-5 space-y-2">
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            No invoices yet.
          </div>
        ) : (
          invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{inv.number}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusStyle[inv.status] ?? statusStyle.draft}`}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-slate-500" dir="auto">
                  {inv.customer_name} · {inv.customer_email}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-emerald-400">
                  {Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })} {inv.currency}
                </span>
                {!ctx.isDemo && inv.status !== "paid" && <MarkPaidButton id={inv.id} />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
