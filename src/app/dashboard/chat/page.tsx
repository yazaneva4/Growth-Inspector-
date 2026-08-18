import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { TeamChat } from "@/components/team-chat";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();

  const { data: recent } =
    !ctx.isDemo && org
      ? await db
          .from("team_messages")
          .select("id, user_id, author_email, body, created_at")
          .eq("org_id", org.id)
          .order("created_at", { ascending: true })
          .limit(200)
      : { data: [] };

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-slate-900">Chat</h1>
      <p className="mt-1 text-sm text-slate-500">
        Real-time private chat between you and your Growth Inspector teammates.
      </p>

      {ctx.isDemo ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Sign in to chat with your team.
        </p>
      ) : (
        <div className="mt-6">
          <TeamChat
            initialMessages={recent ?? []}
            currentUserId={ctx.userId}
            orgId={org?.id ?? null}
          />
        </div>
      )}
    </div>
  );
}
