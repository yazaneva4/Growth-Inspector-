import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { TeamChat } from "@/components/team-chat";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  // Load the most recent 200, then show oldest-first so the newest sits at
  // the bottom like a normal chat.
  const { data: recent } =
    !ctx.isDemo && org
      ? await db
          .from("team_messages")
          .select("id, user_id, author_email, body, created_at")
          .eq("org_id", org.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] };
  const messages = (recent ?? []).slice().reverse();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">Messages</h1>
      <p className="mt-1 text-sm text-slate-500">
        Private team chat between you and your teammates. Updates live — no
        WhatsApp or email needed.
      </p>

      {ctx.isDemo ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Sign in to chat with your team.
        </p>
      ) : (
        <div className="mt-6">
          <TeamChat messages={messages} currentUserId={ctx.userId} />
        </div>
      )}
    </div>
  );
}
