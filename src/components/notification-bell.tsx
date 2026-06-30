"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Note {
  id: string;
  reason: string;
  customer: string;
  created_at: string;
}

/** Live escalation notifications — subscribes to inserts and shows a badge. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("escalations")
        .select("id, reason, created_at, conversations(customer_name, customer_handle)")
        .order("created_at", { ascending: false })
        .limit(10);
      setItems(
        (data ?? []).map((e) => {
          const c = (e.conversations ?? {}) as {
            customer_name?: string;
            customer_handle?: string;
          };
          return {
            id: e.id as string,
            reason: e.reason as string,
            customer: c.customer_name ?? c.customer_handle ?? "Customer",
            created_at: e.created_at as string,
          };
        }),
      );
    }
    load();

    const channel = supabase
      .channel("notif-escalations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escalations" },
        () => {
          load();
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = items.length;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:bg-slate-800"
        aria-label="Notifications"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">
            Escalations needing a human
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-500">
              All clear 🎉
            </p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className="rounded-lg px-2 py-2 text-sm hover:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-slate-200" dir="auto">
                    {n.customer}
                  </span>
                  <span className="ml-2 shrink-0 rounded-full border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-300">
                    {n.reason.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
