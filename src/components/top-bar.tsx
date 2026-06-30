"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";

/** Sticky dashboard top bar: workspace switcher + live bell + avatar. */
export function TopBar({
  workspaceName,
  email,
}: {
  workspaceName: string;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email ?? workspaceName ?? "G").charAt(0).toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-slate-800 bg-slate-950/80 px-8 py-3 backdrop-blur">
      {/* Workspace switcher */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-xs text-emerald-300">
            🏢
          </span>
          <span className="text-left">
            <span className="block text-[10px] leading-none text-slate-500">
              Workspace
            </span>
            <span className="block leading-tight" dir="auto">
              {workspaceName}
            </span>
          </span>
          <span className="text-slate-500">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-900 p-2 text-sm shadow-xl">
            <div className="rounded-lg bg-slate-800 px-3 py-2" dir="auto">
              <div className="font-medium">{workspaceName}</div>
              <div className="text-xs text-emerald-400">Current workspace</div>
            </div>
            <a
              href="/dashboard/team"
              className="mt-1 block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              Invite employees →
            </a>
            <a
              href="/dashboard/plans"
              className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800"
            >
              Manage plan →
            </a>
          </div>
        )}
      </div>

      <NotificationBell />

      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-bold text-slate-950">
        {initial}
      </span>
    </div>
  );
}
