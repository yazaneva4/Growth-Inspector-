import { getCurrentContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/invite-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getCurrentContext();

  if (ctx.isDemo) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to invite employees to your workspace. Each seat is billed on
          your plan.
        </p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Sign in
        </a>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("team_invites")
    .select("email, role, accepted, created_at")
    .order("created_at", { ascending: false });
  const { count: memberCount } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true });

  const rows = invites ?? [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="mt-1 text-sm text-slate-400">
        Invite employees to help answer your inbox. {memberCount ?? 1} active{" "}
        {memberCount === 1 ? "member" : "members"}.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-semibold text-emerald-300">
          Invite an employee
        </h2>
        <InviteForm />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Invitations</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No invitations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email} className="border-t border-slate-800">
                  <td className="py-2" dir="auto">{r.email}</td>
                  <td className="py-2 capitalize text-slate-400">{r.role}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        r.accepted
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-amber-500/40 text-amber-300"
                      }`}
                    >
                      {r.accepted ? "Joined" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
