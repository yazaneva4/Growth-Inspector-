import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";

/**
 * Moyasar success callback. Verifies the invoice was paid, then applies the
 * plan to the org. Moyasar appends ?invoice_id=...&status=paid (and we also
 * carry org/plan we set on the success_url).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const plan = params.get("plan");
  const status = params.get("status");
  const invoiceId = params.get("invoice_id") ?? params.get("id");
  const planDef = PLANS.find((p) => p.tier === plan);

  const back = (msg: string) =>
    NextResponse.redirect(
      new URL(`/dashboard/plans?status=${msg}`, req.url),
    );

  if (!planDef) return back("invalid");

  const secret = process.env.MOYASAR_SECRET_KEY;
  let paid = status === "paid";

  // Verify server-side against Moyasar when possible.
  if (secret && invoiceId) {
    try {
      const res = await fetch(
        `https://api.moyasar.com/v1/invoices/${invoiceId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
          },
        },
      );
      if (res.ok) {
        const inv = await res.json();
        paid = inv.status === "paid";
      }
    } catch {
      // fall back to the query status
    }
  }

  if (!paid) return back("payment_incomplete");

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (membership) {
    await supabase
      .from("organizations")
      .update({ plan: planDef.tier })
      .eq("id", membership.org_id);
  }
  return back("upgraded");
}
