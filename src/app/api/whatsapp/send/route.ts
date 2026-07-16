import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/platforms/adapter";

/**
 * Auto-send a WhatsApp message server-side via the WhatsApp Business Cloud
 * API — the "no manual tap" counterpart to the wa.me draft link. Requires:
 *   1. META_ACCESS_TOKEN configured on the server, and
 *   2. an active connected WhatsApp Business account for the workspace
 *      (its phone_number_id is the sender).
 * Without either, returns a clear error rather than silently no-op'ing, so
 * the UI can tell the user exactly what to set up.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const to = (body?.to as string | undefined)?.trim();
  const text = (body?.body as string | undefined)?.trim();
  if (!to || !text) {
    return NextResponse.json({ error: "to and body required" }, { status: 400 });
  }

  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Auto-send isn't set up yet. Add META_ACCESS_TOKEN (a Meta WhatsApp Business token) on the server to enable it. Until then, use the manual “Send on WhatsApp” link.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "no organization" }, { status: 404 });

  const { data: account } = await supabase
    .from("connected_accounts")
    .select("external_id")
    .eq("org_id", membership.org_id)
    .eq("platform", "whatsapp")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!account?.external_id) {
    return NextResponse.json(
      {
        error:
          "No connected WhatsApp Business account. Connect one in Settings → Connected accounts to auto-send.",
      },
      { status: 400 },
    );
  }

  // Digits only — Meta expects an E.164-style number without symbols.
  const recipient = to.replace(/[^\d]/g, "");
  try {
    await getAdapter("whatsapp").send(account.external_id, recipient, text);
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("WhatsApp auto-send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "WhatsApp send failed" },
      { status: 502 },
    );
  }
}
