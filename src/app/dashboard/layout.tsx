import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TopBar } from "@/components/top-bar";
import { Logo } from "@/components/logo";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "◻" },
  { href: "/dashboard/analytics", label: "Inspector report", icon: "📈" },
  { href: "/dashboard/trends", label: "Trend radar", icon: "📡" },
  { href: "/dashboard/competitors", label: "Competitors", icon: "🎯" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "💬" },
  { href: "/dashboard/escalations", label: "Escalations", icon: "⚠" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "🧾" },
  { href: "/dashboard/settings", label: "Brand voice", icon: "🎙" },
  { href: "/dashboard/team", label: "Team", icon: "👥" },
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
    .select("name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  const workspaceName = org?.name ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800/60 bg-slate-950 p-5">
        {/* Logo */}
        <div className="flex items-center justify-between">
          <Logo variant="dark" />
          <RealtimeRefresh />
        </div>

        {/* Nav */}
        <nav className="mt-7 flex flex-1 flex-col gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <span className="text-xs opacity-60">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Account footer */}
        <div className="mt-4 border-t border-slate-800 pt-4 text-xs">
          {ctx.email ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                  {ctx.email.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-slate-400" title={ctx.email}>
                  {ctx.email}
                </span>
              </div>
              <form action="/auth/signout" method="post">
                <button className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 transition-colors">
                  Sign out
                </button>
              </form>
              <Link
                href="/login?new=1"
                className="block rounded-lg px-3 py-1.5 text-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                + Create another account
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-slate-500">
                Viewing Growth Inspector demo
              </div>
              <Link
                href="/login"
                className="block rounded-lg bg-emerald-500 px-3 py-1.5 text-center font-medium text-white hover:bg-emerald-600 transition-colors"
              >
                Sign in / Create account
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar workspaceName={workspaceName} email={ctx.email} />
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
