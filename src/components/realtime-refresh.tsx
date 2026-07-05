"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIVE_TABLES = [
  "conversations",
  "messages",
  "escalations",
  "invoices",
  "competitors",
  "access_requests",
];

export function RealtimeRefresh() {
  const router = useRouter();
  // The layout mounts this twice (desktop sidebar + mobile menu). The Supabase
  // client dedupes channels by topic, and adding callbacks to an
  // already-subscribed channel THROWS — so each mount needs its own topic.
  const channelId = useId();
  const [connected, setConnected] = useState(false);
  const [pulse, setPulse] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const bump = () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1200);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
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
      supabase.removeChannel(channel);
    };
  }, [router, channelId]);

  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
      style={connected ? { color: "#34d399" } : { color: "#64748b" }}
      title={connected ? "All tables live" : "Connecting…"}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full transition-colors"
        style={{
          background: pulse ? "#86efac" : connected ? "#34d399" : "#475569",
        }}
      />
      {connected ? "Live" : "…"}
    </span>
  );
}
