"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";

export function TopBar({
  workspaceName,
  email,
  onMenuClick,
}: {
  workspaceName: string;
  email: string | null;
  onMenuClick?: () => void;
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
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-8 py-3 backdrop-blur">
      {/* Workspace chip */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ background: "#1B2A6B" }}
          >
            {initial}
          </span>
          <span className="max-w-[160px] truncate" dir="auto">{workspaceName}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-slate-500">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="rounded-lg bg-slate-100 px-3 py-2">
              <div className="font-medium text-sm text-slate-900" dir="auto">{workspaceName}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">Current workspace</div>
            </div>
            <a
              href="/dashboard/team"
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span>👥</span> Invite team members →
            </a>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "#F26522" }}
        >
          {initial}
        </div>
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors lg:hidden"
        >
          ☰
        </button>
      </div>
    </div>
  );
}
