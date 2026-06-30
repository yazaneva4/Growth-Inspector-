import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/types";

const VAT = 0.15; // Saudi VAT

/**
 * Start a plan upgrade. With MOYASAR_SECRET_KEY set, creates a Moyasar invoice
 * (SAR + 15% VAT) and returns its hosted payment URL. Without a key it applies
 * the plan immediately so the flow still works in demo/dev.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const tier = body?.plan as PlanTier | undefined;
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "no organization" }, { status: 404 });
  }

  const secret = process.env.MOYASAR_SECRET_KEY;
  const origin = req.nextUrl.origin;

  // No payment provider configured → apply the plan directly (demo path).
  if (!secret) {
    await supabase
      .from("organizations")
      .update({ plan: plan.tier })
      .eq("id", membership.org_id);
    return NextResponse.json({ ok: true, plan: plan.tier, paid: false });
  }

  // Amount in halalas including VAT.
  const amount = Math.round(plan.price * (1 + VAT) * 100);
  const successUrl = `${origin}/dashboard/plans/success?org=${membership.org_id}&plan=${plan.tier}`;

  const res = await fetch("https://api.moyasar.com/v1/invoices", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "SAR",
      description: `Growth Inspector — ${plan.name} plan (monthly, incl. VAT)`,
      success_url: successUrl,
      back_url: `${origin}/dashboard/plans`,
      metadata: { org_id: membership.org_id, plan: plan.tier },
    }),
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `payment init failed: ${res.status}` },
      { status: 502 },
    );
  }
  const invoice = await res.json();
  return NextResponse.json({ url: invoice.url });
}
