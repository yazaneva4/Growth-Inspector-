import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Claim or reassign a conversation. Runs on the caller's own session (not
 * service-role) so RLS enforces they can actually see this conversation
 * (unassigned, already theirs, or they're an owner/admin) before the update
 * is allowed to go through.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  // null clears the assignment (back to the shared/unclaimed queue).
  const assignedTo: string | null = body?.assignedTo ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ assigned_to: assignedTo })
    .eq("id", id)
    .select("id, assigned_to")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, conversation: data });
}
