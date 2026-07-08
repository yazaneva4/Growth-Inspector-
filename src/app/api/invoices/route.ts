import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInvoiceEmail, type InvoiceItem } from "@/lib/email/invoice";

const VAT_RATE = 0.15; // Saudi VAT

/** Create an invoice for the signed-in workspace and email it to the customer. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const customerName = (body?.customerName as string | undefined)?.trim();
  const customerEmail = (body?.customerEmail as string | undefined)?.trim().toLowerCase();
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  const items: InvoiceItem[] = rawItems
    .map((it: Record<string, unknown>) => ({
      description: String(it?.description ?? "").trim(),
      qty: Number(it?.qty),
      unit_price: Number(it?.unit_price),
    }))
    .filter(
      (it: InvoiceItem) =>
        it.description && Number.isFinite(it.qty) && it.qty > 0 &&
        Number.isFinite(it.unit_price) && it.unit_price >= 0,
    );

  if (!customerName || !customerEmail || !customerEmail.includes("@") || items.length === 0) {
    return NextResponse.json(
      { error: "customerName, valid customerEmail and at least one line item are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no organization" }, { status: 404 });

  const orgName =
    (membership.organizations as { name?: string } | null)?.name ?? "Growth Inspector";

  // Sequential per-org number: INV-<year>-<seq>.
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", membership.org_id);
  const number = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  let delivered = false;
  let emailError: string | null = null;
  try {
    delivered = await sendInvoiceEmail({
      number,
      orgName,
      customerName,
      customerEmail,
      items,
      subtotal,
      vat,
      total,
      currency: "SAR",
      date: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    emailError = err instanceof Error ? err.message : "email failed";
    console.error(`Invoice email failed for ${customerEmail}:`, err);
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      org_id: membership.org_id,
      number,
      customer_name: customerName,
      customer_email: customerEmail,
      items,
      subtotal,
      vat,
      total,
      currency: "SAR",
      status: delivered ? "sent" : "draft",
      sent_at: delivered ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, invoice, delivered, emailError });
}

/** Mark an invoice paid (RLS scopes the update to the caller's workspace). */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { error } = await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
