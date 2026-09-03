"use client";

import { useEffect, useState } from "react";

type AgentMode = "local" | "cloud" | "auto";
type PermissionMode = "ask" | "auto" | "skip" | "manual";
type LocalStatus = "checking" | "online" | "offline";

const MODE_KEY = "growth-ai-agent-mode-v1";
const PERMISSION_KEY = "growth-ai-permission-mode-v1";
const LOCAL_HEALTH_URL = "http://127.0.0.1:8787/health";

function isMode(value: string | null): value is AgentMode {
  return value === "local" || value === "cloud" || value === "auto";
}

function isPermission(value: string | null): value is PermissionMode {
  return value === "ask" || value === "auto" || value === "skip" || value === "manual";
}

function persistCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function GrowthAiAgentControls() {
  const [mode, setMode] = useState<AgentMode>("auto");
  const [permission, setPermission] = useState<PermissionMode>("ask");
  const [localStatus, setLocalStatus] = useState<LocalStatus>("checking");

  const checkLocalAgent = async () => {
    setLocalStatus("checking");
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1200);
      const response = await fetch(LOCAL_HEALTH_URL, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      setLocalStatus(response.ok ? "online" : "offline");
    } catch {
      setLocalStatus("offline");
    }
  };

  useEffect(() => {
    const savedMode = localStorage.getItem(MODE_KEY);
    const savedPermission = localStorage.getItem(PERMISSION_KEY);
    const initialMode = isMode(savedMode) ? savedMode : "auto";
    const initialPermission = isPermission(savedPermission) ? savedPermission : "ask";
    setMode(initialMode);
    setPermission(initialPermission);
    persistCookie("growth_ai_agent_mode", initialMode);
    persistCookie("growth_ai_permission_mode", initialPermission);
    void checkLocalAgent();
    const interval = window.setInterval(() => void checkLocalAgent(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  function changeMode(next: AgentMode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
    persistCookie("growth_ai_agent_mode", next);
    window.dispatchEvent(new CustomEvent("growth-ai-agent-mode-change", { detail: { mode: next } }));
  }

  function changePermission(next: PermissionMode) {
    setPermission(next);
    localStorage.setItem(PERMISSION_KEY, next);
    persistCookie("growth_ai_permission_mode", next);
    window.dispatchEvent(new CustomEvent("growth-ai-permission-mode-change", { detail: { permission: next } }));
  }

  const statusText = localStatus === "online" ? "Local agent online" : localStatus === "checking" ? "Checking local agent…" : "Local agent offline";
  const statusClass = localStatus === "online" ? "bg-emerald-500" : localStatus === "checking" ? "bg-amber-400" : "bg-rose-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Agent</span>
          <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Growth AI agent mode">
            {([
              ["local", "🖥️ Local"],
              ["cloud", "☁️ Cloud"],
              ["auto", "⚡ Auto"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => changeMode(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600">
            <span className={`h-2 w-2 rounded-full ${statusClass}`} />
            {statusText}
          </span>
          {mode === "auto" && <span className="text-[11px] text-slate-400">Auto chooses the stronger available environment for each task.</span>}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold">Permissions</span>
          <select value={permission} onChange={(event) => changePermission(event.target.value as PermissionMode)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none">
            <option value="ask">Ask</option>
            <option value="auto">Auto</option>
            <option value="skip">Skip all permissions</option>
            <option value="manual">Manual</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Skip all permissions disables Growth AI permission prompts. It does not bypass the app's safety rules.</p>
      {mode === "local" && localStatus === "offline" && <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">Local Agent is offline. Start the Growth AI local agent on this computer, then retry. Local Mode will not silently switch to Cloud.</div>}
      {mode === "auto" && localStatus === "offline" && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">Local Agent is offline. Auto can use Cloud until the local agent reconnects.</div>}
    </div>
  );
}
