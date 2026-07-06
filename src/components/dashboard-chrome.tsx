"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Logo, LogoMark } from "@/components/logo";
import { TopBar } from "@/components/top-bar";

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

/**
 * App-style shell: a right-hand sidebar that's persistent + collapsible to an
 * icon rail on desktop, and slides in as an overlay drawer (triggered by the
 * hamburger in TopBar) on mobile — the collapse state is remembered locally.
 */
export function DashboardChrome({
  workspaceName,
  email,
  children,
}: {
  workspaceName: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("gi-sidebar-collapsed") === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("gi-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          workspaceName={workspaceName}
          email={email}
          onMenuClick={() => setMobileOpen(true)}
        />
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out lg:static lg:shadow-none lg:transition-[width] ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        } lg:translate-x-0 ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-4">
          <div className={collapsed ? "lg:hidden" : ""}>
            <Logo variant="light" />
          </div>
          {collapsed && (
            <LogoMark size={32} className="hidden lg:mx-auto lg:block" />
          )}
          <div className={`flex items-center gap-1 ${collapsed ? "lg:hidden" : ""}`}>
            <RealtimeRefresh />
          </div>
          <button
            onClick={toggleCollapsed}
            aria-label="Toggle sidebar"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:flex"
          >
            {collapsed ? "‹" : "›"}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                title={collapsed ? n.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  collapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  active
                    ? "bg-emerald-500/10 text-emerald-600 font-medium"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="text-xs opacity-70">{n.icon}</span>
                <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-slate-200 p-3 text-xs ${collapsed ? "lg:hidden" : ""}`}>
          <AccountFooter email={email} />
        </div>
      </aside>
    </div>
  );
}
