import { SITE_URL } from "@/lib/site";

/**
 * Moyasar — Saudi payment gateway (mada, Visa/Mastercard, Apple Pay, STC
 * Pay). Used to generate a real hosted payment page for an invoice so the
 * customer can actually pay online, instead of a static PDF/HTML invoice
 * with no way to pay. Requires a real Moyasar merchant account.
 */
export function moyasarConfigured(): boolean {
  return Boolean(process.env.MOYASAR_SECRET_KEY);
}

export interface MoyasarInvoice {
  id: string;
  url: string;
}

/**
 * Creates a Moyasar-hosted invoice/payment page for the given amount.
 * Amount is in the invoice's minor currency unit (halalas for SAR, i.e.
 * total * 100). Throws if Moyasar isn't configured or the API call fails —
 * callers should catch and fall back to emailing the invoice without a
 * payment link rather than pretending one exists.
 */
export async function createMoyasarInvoice(opts: {
  amountMinor: number;
  currency: string;
  description: string;
  invoiceNumber: string;
}): Promise<MoyasarInvoice> {
  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) throw new Error("MOYASAR_SECRET_KEY not configured");

  const res = await fetch("https://api.moyasar.com/v1/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.amountMinor,
      currency: opts.currency,
      description: opts.description,
      callback_url: `${SITE_URL}/api/webhooks/moyasar`,
      success_url: `${SITE_URL}/dashboard/invoices?paid=1`,
      back_url: `${SITE_URL}/dashboard/invoices`,
      metadata: { invoice_number: opts.invoiceNumber },
    }),
  });

  if (!res.ok) {
    throw new Error(`Moyasar invoice creation failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { id: data.id, url: data.url };
}
