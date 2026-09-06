import { getCurrentContext } from "@/lib/auth";
import { ChatsHub } from "@/components/chats-hub";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ctx = await getCurrentContext();

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">Chats</h1>
      <p className="mt-1 text-sm text-slate-500">
        Personal and group conversations with your Growth Inspector team, updated in real time.
      </p>

      {ctx.isDemo ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Sign in to use personal and group chats.
        </p>
      ) : (
        <div className="mt-6">
          <ChatsHub />
        </div>
      )}
    </div>
  );
}
