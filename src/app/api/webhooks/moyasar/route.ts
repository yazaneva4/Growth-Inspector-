import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Moyasar webhook — configure this URL in your Moyasar dashboard
 * (Settings → Webhooks) subscribed to invoice/payment events. On a paid
 * event, marks the matching invoice as paid automatically so the org
 * doesn't have to manually check and click "Mark as Paid".
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  // Moyasar sends either invoice objects directly or {type, data} envelopes
  // depending on the event source; handle both shapes defensively.
  const invoice = payload.data ?? payload;
  const status: string | undefined = invoice?.status;
  const moyasarId: string | undefined = invoice?.id;

  if (status === "paid" && moyasarId) {
    const db = createServiceClient();
    await db.from("invoices").update({ status: "paid" }).eq("moyasar_id", moyasarId);
  }

  return NextResponse.json({ ok: true });
}
