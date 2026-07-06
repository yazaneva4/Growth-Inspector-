import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES } from "@/lib/constants";

/** Saves the onboarding form (full name, company, industry, country) to the
 *  caller's organization and marks it onboarded. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = (body?.fullName as string | undefined)?.trim();
  const companyName = (body?.companyName as string | undefined)?.trim();
  const industry = (body?.industry as string | undefined)?.trim();
  const country = (body?.country as string | undefined)?.trim() || "Saudi Arabia";

  if (!fullName || !companyName || !industry) {
    return NextResponse.json(
      { error: "fullName, companyName and industry are required" },
      { status: 400 },
    );
  }
  if (!INDUSTRIES.includes(industry)) {
    return NextResponse.json({ error: "invalid industry" }, { status: 400 });
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

  const { error } = await supabase
    .from("organizations")
    .update({
      name: companyName,
      owner_full_name: fullName,
      industry,
      country,
      onboarded: true,
    })
    .eq("id", membership.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
