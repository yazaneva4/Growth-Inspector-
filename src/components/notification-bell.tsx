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

/** Live escalation notifications — subscribes to database changes. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: rows } = await supabase
        .from("escalations")
        .select("id, reason, created_at, conversation_id")
        .order("created_at", { ascending: false })
        .limit(10);

      const escalationRows = rows ?? [];
      const conversationIds = escalationRows.map((row) => row.conversation_id).filter(Boolean);
      const { data: conversations } = conversationIds.length
        ? await supabase.from("conversations").select("id, customer_name, customer_handle").in("id", conversationIds)
        : { data: [] };
      const byId = new Map((conversations ?? []).map((conversation) => [conversation.id as string, conversation]));

      setItems(
        escalationRows.map((e) => {
          const c = byId.get(e.conversation_id as string) as { customer_name?: string | null; customer_handle?: string | null } | undefined;
          return {
            id: e.id as string,
            reason: e.reason as string,
            customer: c?.customer_name ?? c?.customer_handle ?? "Customer",
            created_at: e.created_at as string,
          };
        }),
      );
    }

    void load();

    const channel = supabase
      .channel("notif-escalations")
      .on("postgres_changes", { event: "*", schema: "public", table: "escalations" }, () => {
        void load();
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = items.length;

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
        🔔
        {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Escalations needing a human</div>
          {items.length === 0 ? <p className="px-2 py-4 text-center text-sm text-slate-500">All clear 🎉</p> : items.map((n) => (
            <div key={n.id} className="rounded-lg px-2 py-2 text-sm hover:bg-slate-100">
              <div className="flex items-center justify-between">
                <span className="truncate text-slate-800" dir="auto">{n.customer}</span>
                <span className="ml-2 shrink-0 rounded-full border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-600">{n.reason.replace(/_/g, " ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
