import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTwilioSignature } from "@/lib/voice";

/**
 * Optional Twilio status callback — set as the "Status Callback URL" on the
 * number. Closes the caller's open conversation once the call actually ends,
 * so it doesn't stay "open" forever if the caller hangs up mid-gather.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(req.url, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const status = params.CallStatus;
  const toNumber = params.To ?? "";
  const fromNumber = params.From ?? "";

  if (status === "completed" || status === "no-answer" || status === "busy" || status === "failed") {
    const db = createServiceClient();
    const { data: account } = await db
      .from("connected_accounts")
      .select("id")
      .eq("platform", "call")
      .eq("external_id", toNumber)
      .maybeSingle();
    if (account) {
      await db
        .from("conversations")
        .update({ status: "closed" })
        .eq("account_id", account.id)
        .eq("customer_handle", fromNumber)
        .eq("status", "open");
    }
  }

  return NextResponse.json({ ok: true });
}
