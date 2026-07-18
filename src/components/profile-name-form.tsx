"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Lets the signed-in user set their display name, stored on their Supabase
 *  auth profile (user_metadata.full_name). The AI uses it to address them,
 *  and it shows in the greeting/sidebar. */
export function ProfileNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      });
      if (error) throw error;
      setMsg("Saved ✓");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        dir="auto"
        className="flex-1 min-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {busy ? "…" : "Save name"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </form>
  );
}
