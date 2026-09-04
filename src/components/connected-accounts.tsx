"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; platform: string; external_id: string; display_name: string; is_active: boolean };
const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", x: "X (Twitter)", snapchat: "Snapchat", tiktok: "TikTok" };
const PLATFORM_ID_HINT: Record<string, string> = { instagram: "Page / IG-connected id", x: "X account handle or id", snapchat: "Snapchat account id", tiktok: "TikTok account id" };

export function ConnectedAccounts({ accounts, webhookBase }: { accounts: Account[]; webhookBase: string }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("instagram");
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const res = await fetch("/api/settings/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, externalId, displayName }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to connect");
      setExternalId(""); setDisplayName(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to connect"); }
    finally { setBusy(false); }
  }

  async function disconnect(id: string) {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/settings/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to disconnect account");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to disconnect account"); }
    finally { setBusy(false); }
  }

  return <div>
    {accounts.length > 0 && <div className="mb-4 space-y-2">{accounts.map((a) => <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"><div><span className="font-medium">{PLATFORM_LABEL[a.platform] ?? a.platform}</span><span className="ml-2 text-slate-500" dir="auto">{a.display_name}</span><span className="ml-2 text-xs text-slate-400">({a.external_id})</span></div><button onClick={() => disconnect(a.id)} disabled={busy} className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50">Disconnect</button></div>)}</div>}
    <form onSubmit={submit} className="grid gap-2.5 sm:grid-cols-2">
      <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500">{Object.entries(PLATFORM_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (e.g. Main support line)" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" />
      <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder={PLATFORM_ID_HINT[platform] ?? "Account id"} required className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500" />
      <button type="submit" disabled={busy} className="sm:col-span-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? "…" : "Connect account"}</button>
      {error && <p className="sm:col-span-2 text-xs text-rose-600">{error}</p>}
    </form>
    <p className="mt-3 text-xs text-slate-500">Point the platform&rsquo;s webhook at <code className="rounded bg-slate-100 px-1 py-0.5">{webhookBase}/instagram</code> (etc.) once connected.</p>
  </div>;
}
