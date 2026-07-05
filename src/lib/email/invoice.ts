import { sendEmail } from "@/lib/email/send";

export interface InvoiceItem {
  description: string;
  qty: number;
  unit_price: number;
}

export interface InvoiceData {
  number: string;
  orgName: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  date: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bilingual (AR/EN) HTML invoice, brand colors: navy / white / orange. */
export function buildInvoiceHtml(inv: InvoiceData): string {
  const rows = inv.items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${esc(it.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmt(it.unit_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmt(it.qty * it.unit_price)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0d1b36;color:#ffffff;padding:28px 32px;">
      <div style="font-size:22px;font-weight:bold;">
        ${esc(inv.orgName)}
      </div>
      <div style="color:#fb923c;font-size:13px;margin-top:4px;">
        فاتورة ضريبية · Tax Invoice
      </div>
    </div>

    <div style="padding:28px 32px;">
      <table style="width:100%;font-size:14px;margin-bottom:24px;">
        <tr>
          <td>
            <div style="color:#64748b;font-size:12px;">Invoice · رقم الفاتورة</div>
            <div style="font-weight:bold;">${esc(inv.number)}</div>
          </td>
          <td style="text-align:right;">
            <div style="color:#64748b;font-size:12px;">Date · التاريخ</div>
            <div style="font-weight:bold;">${esc(inv.date)}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:16px;">
            <div style="color:#64748b;font-size:12px;">Billed to · الفاتورة إلى</div>
            <div style="font-weight:bold;">${esc(inv.customerName)}</div>
            <div style="color:#64748b;">${esc(inv.customerEmail)}</div>
          </td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;color:#334155;font-size:12px;">
            <th style="padding:10px 12px;text-align:left;">Description · الوصف</th>
            <th style="padding:10px 12px;text-align:center;">Qty · الكمية</th>
            <th style="padding:10px 12px;text-align:right;">Price · السعر</th>
            <th style="padding:10px 12px;text-align:right;">Total · الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="width:100%;font-size:14px;margin-top:20px;">
        <tr>
          <td style="text-align:right;color:#64748b;padding:4px 12px;">Subtotal · المجموع الفرعي</td>
          <td style="text-align:right;width:130px;padding:4px 0;">${fmt(inv.subtotal)} ${esc(inv.currency)}</td>
        </tr>
        <tr>
          <td style="text-align:right;color:#64748b;padding:4px 12px;">VAT 15% · ضريبة القيمة المضافة</td>
          <td style="text-align:right;padding:4px 0;">${fmt(inv.vat)} ${esc(inv.currency)}</td>
        </tr>
        <tr>
          <td style="text-align:right;font-weight:bold;font-size:16px;padding:10px 12px;">Total · الإجمالي المستحق</td>
          <td style="text-align:right;font-weight:bold;font-size:16px;color:#f97316;padding:10px 0;">${fmt(inv.total)} ${esc(inv.currency)}</td>
        </tr>
      </table>
    </div>

    <div style="background:#f8fafc;padding:18px 32px;font-size:12px;color:#64748b;text-align:center;">
      Sent with Growth Inspector · شكراً لتعاملكم معنا
    </div>
  </div>
</body>
</html>`;
}

/**
 * Emails the invoice via the app transport (Gmail SMTP when GMAIL_USER +
 * GMAIL_APP_PASSWORD are set, else Resend). Returns true when actually
 * delivered; false when no transport is configured (invoice stays a draft).
 */
export async function sendInvoiceEmail(inv: InvoiceData): Promise<boolean> {
  return sendEmail({
    to: inv.customerEmail,
    subject: `Invoice ${inv.number} · فاتورة من ${inv.orgName}`,
    html: buildInvoiceHtml(inv),
  });
}
