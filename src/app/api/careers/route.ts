import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

/** Public job-application intake. Anyone can submit; rows are reviewed in
 *  Supabase (anon cannot read them back). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const full_name = (body?.full_name as string | undefined)?.trim();
  const email = (body?.email as string | undefined)?.trim();
  if (!full_name || !email || !email.includes("@")) {
    return NextResponse.json(
      { error: "name and a valid email are required" },
      { status: 400 },
    );
  }

  const db = createPublicClient();
  const { error } = await db.from("job_applications").insert({
    full_name,
    email,
    phone: (body?.phone as string | undefined)?.trim() || null,
    role_interest: (body?.role_interest as string | undefined)?.trim() || null,
    message: (body?.message as string | undefined)?.trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
