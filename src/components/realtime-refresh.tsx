"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to live changes on conversations / messages / escalations and
 * re-renders the dashboard server components when something happens. RLS still
 * applies, so each subscriber only receives rows from its own workspace (or the
 * public demo). Shows a small "live" indicator.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const bump = () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
      if (timer.current) clearTimeout(timer.current);
      // Debounce bursts of events into a single refresh.
      timer.current = setTimeout(() => router.refresh(), 500);
    };

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        bump,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        bump,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "escalations" },
        bump,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        bump,
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-slate-400"
      title={connected ? "Live updates on" : "Connecting…"}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          pulse
            ? "bg-emerald-300"
            : connected
              ? "bg-emerald-500"
              : "bg-slate-600"
        }`}
      />
      {connected ? "Live" : "…"}
    </span>
  );
}
