"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Keep the global dashboard listener focused on data that genuinely needs
// instant refreshes. Subscribing to every admin/CRM table made unrelated DB
// writes trigger expensive full-page router.refresh() calls.
const LIVE_TABLES = ["conversations", "messages", "escalations", "team_messages"];

export function RealtimeRefresh() {
  const router = useRouter();
  const channelId = useId();
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const bump = () => {
      setPulse(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 900);

      // Coalesce bursts of changes into one refresh instead of refreshing the
      // entire dashboard repeatedly during an import/webhook spike.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 1200);
    };

    let channel = supabase.channel(`dashboard-realtime-${channelId}`);
    for (const table of LIVE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        bump,
      );
    }
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      supabase.removeChannel(channel);
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
