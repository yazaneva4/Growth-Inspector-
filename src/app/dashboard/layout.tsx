import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TopBar } from "@/components/top-bar";
import { PLANS } from "@/lib/plans";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/analytics", label: "Inspector report" },
  { href: "/dashboard/trends", label: "Trend radar" },
  { href: "/dashboard/competitors", label: "Competitors" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/escalations", label: "Escalations" },
  { href: "/dashboard/settings", label: "Brand voice" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/plans", label: "Plans" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentContext();

  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("plan, name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  const plan = PLANS.find((p) => p.tier === org?.plan) ?? PLANS[0];
  const workspaceName = org?.name ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 p-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            Growth<span className="text-emerald-400"> Inspector</span>
          </Link>
          <RealtimeRefresh />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Plan widget */}
        <Link
          href="/dashboard/plans"
          className="mt-4 block rounded-2xl border border-slate-800 bg-gradient-to-b from-violet-500/10 to-slate-900/60 p-4 hover:border-violet-500/40"
        >
          <div className="text-sm font-semibold">{plan.name} plan</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {plan.price.toLocaleString()} SAR / mo
          </div>
          <div className="mt-3 rounded-lg bg-emerald-500 px-3 py-1.5 text-center text-xs font-semibold text-slate-950">
            {plan.tier === "agency" ? "Manage plan" : "Upgrade"}
          </div>
        </Link>

        <div className="mt-4 border-t border-slate-800 pt-4 text-xs">
          {ctx.email ? (
            <>
              <div className="truncate text-slate-400" title={ctx.email}>
                {ctx.email}
              </div>
              <form action="/auth/signout" method="post" className="mt-2">
                <button className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-slate-500">Viewing the demo workspace</div>
              <Link
                href="/login"
                className="mt-2 block rounded-lg bg-emerald-500 px-3 py-1.5 text-center font-medium text-slate-950 hover:bg-emerald-400"
              >
                Sign in / Create account
              </Link>
            </>
          )}
        </div>
      </aside>
      <main className="flex-1">
        <TopBar workspaceName={workspaceName} email={ctx.email} />
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
