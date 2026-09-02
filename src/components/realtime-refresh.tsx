"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * One connection for the whole authenticated dashboard. Supabase Realtime
 * applies the database's RLS rules before delivering Postgres Changes, so the
 * browser never gets rows the signed-in user cannot read.
 *
 * We deliberately use the wildcard table subscription here. New workspace
 * tables therefore become live automatically as soon as they are added to
 * the supabase_realtime publication, instead of silently falling back to
 * stale UI because someone forgot to update this list.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const channelId = useId();
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const refresh = () => {
      setPulse(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 900);

      // Coalesce bursts (imports, webhook batches, AI-generated updates) into
      // one server-component refresh rather than hammering the app with a
      // refresh for every row.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 150);
    };

    const channel = supabase
      .channel(`dashboard-realtime-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "*" },
        refresh,
      )
      .subscribe((status) => {
        const live = status === "SUBSCRIBED";
        setConnected(live);
        if (live) {
          // Reconcile immediately after a reconnect. This closes the small
          // gap where the browser was offline while database changes landed.
          router.refresh();
        }
      });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [router, channelId]);

  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
      style={connected ? { color: "#34d399" } : { color: "#64748b" }}
      title={connected ? "Live updates connected" : "Connecting…"}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full transition-colors"
        style={{
          background: pulse ? "#86efac" : connected ? "#34d399" : "#475569",
        }}
      />
      <span className="hidden sm:inline">{connected ? "Live" : "…"}</span>
    </span>
  );
}
