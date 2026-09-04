"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Logo, LogoMark } from "@/components/logo";
import { TopBar } from "@/components/top-bar";
import { SparkleIcon } from "@/components/sparkle-icon";

const navGroups = [
  { label: "MAIN", items: [{ href: "/dashboard", label: "Overview", icon: "◻" }, { href: "/dashboard/leads", label: "Leads", icon: "🧲" }, { href: "/dashboard/pipeline", label: "Pipeline", icon: "🔀" }] },
  { label: "GROWTH", items: [{ href: "/dashboard/analytics", label: "Inspector report", icon: "📈" }, { href: "/dashboard/trends", label: "Trend radar", icon: "📡" }, { href: "/dashboard/agent", label: "Growth Operator", icon: "sparkle" }, { href: "/dashboard/competitors", label: "Competitors", icon: "🎯" }] },
  { label: "INBOX", items: [{ href: "/dashboard/inbox", label: "Inbox", icon: "💬" }, { href: "/dashboard/chat", label: "Chat", icon: "🗨" }, { href: "/dashboard/escalations", label: "Escalations", icon: "⚠" }, { href: "/dashboard/invoices", label: "Invoices", icon: "🧾" }] },
  { label: "RECORDS", items: [{ href: "/dashboard/quotes", label: "All Quotes", icon: "📄" }, { href: "/dashboard/jobs", label: "Active Jobs", icon: "🛠" }, { href: "/dashboard/archive", label: "Archive", icon: "🗄" }, { href: "/dashboard/trash", label: "Trash", icon: "🗑" }] },
  { label: "CRM", items: [{ href: "/dashboard/clients", label: "Clients", icon: "🏢" }, { href: "/dashboard/products", label: "Products", icon: "📦" }, { href: "/dashboard/quote-types", label: "Quote Types", icon: "🏷" }, { href: "/dashboard/reports", label: "Reports", icon: "📊" }, { href: "/dashboard/retainers", label: "Retainers", icon: "🔁" }] },
  { label: "SETTINGS", items: [{ href: "/dashboard/settings", label: "Settings", icon: "⚙" }, { href: "/dashboard/team", label: "Team", icon: "👥" }, { href: "/dashboard/my-tasks", label: "My Tasks", icon: "✅" }, { href: "/dashboard/users", label: "Users", icon: "🧑‍💼" }] },
];

function AccountFooter({ email }: { email: string | null }) {
  if (email) return <div className="space-y-2"><div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-600">{email.charAt(0).toUpperCase()}</span><span className="truncate text-slate-500" title={email}>{email}</span></div><form action="/auth/signout" method="post"><button className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">Sign out</button></form><Link href="/login?new=1" className="block rounded-lg px-3 py-1.5 text-center text-slate-500 hover:text-slate-900 transition-colors">+ Create another account</Link></div>;
  return <div className="space-y-2"><div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-500">Viewing Growth Inspector demo</div><Link href="/login" className="block rounded-lg bg-emerald-500 px-3 py-1.5 text-center font-medium text-white hover:bg-emerald-600 transition-colors">Sign in / Create account</Link></div>;
}

export function DashboardChrome({ workspaceName, email, children }: { workspaceName: string; email: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("gi-sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("gi-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return <div className="flex min-h-screen bg-white text-slate-900 lg:h-screen lg:overflow-hidden">
    {mobileOpen && <div onClick={() => setMobileOpen(false)} aria-hidden className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out lg:static lg:h-full lg:shadow-none lg:transition-[width] ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-4"><div className={collapsed ? "lg:hidden" : ""}><Logo variant="light" /></div>{collapsed && <LogoMark size={32} className="hidden lg:mx-auto lg:block" />}<div className={`flex items-center gap-1 ${collapsed ? "lg:hidden" : ""}`}><RealtimeRefresh /></div><button onClick={toggleCollapsed} aria-label="Toggle sidebar" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:flex">{collapsed ? "›" : "‹"}</button><button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden">✕</button></div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">{navGroups.map((group) => <div key={group.label}><div className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>{group.label}</div><div className="space-y-0.5">{group.items.map((n) => { const active = pathname === n.href; return <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "bg-emerald-500/10 text-emerald-600 font-medium" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>{n.icon === "sparkle" ? <SparkleIcon className="text-xs" /> : <span className="text-xs opacity-70">{n.icon}</span>}<span className={collapsed ? "lg:hidden" : ""}>{n.label}</span></Link>; })}</div></div>)}</nav>
      <div className={`border-t border-slate-200 p-3 text-xs ${collapsed ? "lg:hidden" : ""}`}><AccountFooter email={email} /></div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden"><TopBar workspaceName={workspaceName} email={email} onMenuClick={() => setMobileOpen(true)} /><div className="flex-1 p-4 sm:p-6 lg:overflow-y-auto lg:p-8">{children}</div></main>
  </div>;
}
