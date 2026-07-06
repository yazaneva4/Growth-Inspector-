import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TopBar } from "@/components/top-bar";
import { Logo } from "@/components/logo";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "◻" },
  { href: "/dashboard/analytics", label: "Inspector report", icon: "📈" },
  { href: "/dashboard/trends", label: "Trend radar", icon: "📡" },
  { href: "/dashboard/agent", label: "Growth Agent", icon: "🤖" },
  { href: "/dashboard/competitors", label: "Competitors", icon: "🎯" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "💬" },
  { href: "/dashboard/escalations", label: "Escalations", icon: "⚠" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "🧾" },
  { href: "/dashboard/settings", label: "Brand voice", icon: "🎙" },
  { href: "/dashboard/team", label: "Team", icon: "👥" },
];

function NavLinks() {
  return (
    <nav className="flex flex-col gap-0.5">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <span className="text-xs opacity-60">{n.icon}</span>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

function AccountFooter({ email }: { email: string | null }) {
  if (email) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-600">
            {email.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-slate-500" title={email}>
            {email}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
            Sign out
          </button>
        </form>
        <Link
          href="/login?new=1"
          className="block rounded-lg px-3 py-1.5 text-center text-slate-500 hover:text-slate-900 transition-colors"
        >
          + Create another account
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-500">
        Viewing Growth Inspector demo
      </div>
      <Link
        href="/login"
        className="block rounded-lg bg-emerald-500 px-3 py-1.5 text-center font-medium text-white hover:bg-emerald-600 transition-colors"
      >
        Sign in / Create account
      </Link>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentContext();

  if (!ctx.isDemo && !ctx.onboarded) {
    redirect("/onboarding");
  }

  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  const workspaceName = org?.name ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <div className="flex items-center justify-between">
          <Logo variant="light" />
          <RealtimeRefresh />
        </div>
        <div className="mt-7 flex-1">
          <NavLinks />
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4 text-xs">
          <AccountFooter email={ctx.email} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with collapsible menu */}
        <details className="group border-b border-slate-200 bg-white lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
            <Logo variant="light" size={40} />
            <span className="flex items-center gap-3">
              <RealtimeRefresh />
              <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 group-open:hidden">
                ☰ Menu
              </span>
              <span className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 group-open:inline">
                ✕ Close
              </span>
            </span>
          </summary>
          <div className="border-t border-slate-200 px-4 py-4">
            <NavLinks />
            <div className="mt-4 border-t border-slate-200 pt-4 text-xs">
              <AccountFooter email={ctx.email} />
            </div>
          </div>
        </details>

        <TopBar workspaceName={workspaceName} email={ctx.email} />
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
