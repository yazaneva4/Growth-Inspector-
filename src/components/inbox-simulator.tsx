"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResponderResult } from "@/lib/ai/responder";
import { MicButton } from "@/components/mic-button";

type Turn =
  | { who: "customer"; body: string }
  | { who: "ai"; body: string; result: ResponderResult }
  | { who: "system"; body: string };

const SAMPLES = [
  "How much is the Cambodian oud? And how long is delivery to Riyadh?",
  "Do you have same-day delivery? I need a gift urgently",
  "Honestly your service is bad — my order is a week late 😡",
  "Do you ship to Jeddah and what are the prices?",
];

const decisionStyle: Record<string, string> = {
  send: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  escalate: "bg-rose-500/15 text-rose-600 border-rose-500/40",
};

export function InboxSimulator({ selfName }: { selfName?: string | null }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"autonomous" | "approval">("autonomous");
  const [persist, setPersist] = useState(true);
  const [channel, setChannel] = useState<"sandbox" | "email">("sandbox");
  const [loading, setLoading] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);

  function speakBrowser(text: string, lang?: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "en" ? "en-US" : "ar-SA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  async function speak(text: string, lang?: string) {
    if (!speakReplies || typeof window === "undefined") return;
    // Prefer the high-quality ElevenLabs voice; if it isn't configured
    // (503) or errors, fall back to the browser's built-in voice.
    try {
      const res = await fetch("/api/voice-chat/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        window.speechSynthesis?.cancel();
        await audio.play();
        return;
      }
    } catch {
      // fall through to browser TTS
    }
    speakBrowser(text, lang);
  }

  const [handle] = useState(
    () => "demo_" + Math.random().toString(36).slice(2, 8),
  );

  async function send(message: string) {
    if (!message.trim() || loading) return;
    setInput("");
    const history = turns
      .filter((t) => t.who !== "system")
      .map((t) => ({ author: t.who, body: t.body }));
    setTurns((t) => [...t, { who: "customer", body: message }]);
    setLoading(true);
    try {
      const endpoint = persist ? "/api/inbox" : "/api/simulate";
      const payload = persist
        ? {
            message,
            channel,
            customerHandle:
              channel === "email" ? `${handle}@example.com` : handle,
            customerName: selfName ?? undefined,
          }
        : { message, replyMode: mode, history, customerName: selfName ?? undefined };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns((t) => [...t, { who: "system", body: data.error ?? "Error" }]);
        return;
      }
      const result = (persist ? data.result : data) as ResponderResult;
      if (!result) {
        setTurns((t) => [...t, { who: "system", body: "No result returned" }]);
        return;
      }
      if (result.decision === "escalate") {
        setTurns((t) => [
          ...t,
          {
            who: "system",
            body:
              "Escalated to a human" +
              (result.escalation_reason
                ? ` (${result.escalation_reason.replace(/_/g, " ")})`
                : "") +
              (result.reply ? `. Draft saved: “${result.reply}”` : "."),
          },
        ]);
      } else {
        setTurns((t) => [...t, { who: "ai", body: result.reply, result }]);
        speak(result.reply, result.analysis.language === "en" ? "en" : "ar");
      }
      if (persist) router.refresh();
    } catch {
      setTurns((t) => [...t, { who: "system", body: "Network error" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Test the responder</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={speakReplies}
              onChange={(e) => setSpeakReplies(e.target.checked)}
              className="accent-emerald-500"
            />
            🔊 Speak replies
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="accent-emerald-500"
            />
            Save to workspace
          </label>
          {persist && (
            <div className="flex rounded-lg border border-slate-300 text-xs">
              {(["sandbox", "email"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`px-3 py-1.5 ${
                    channel === c ? "bg-sky-500 text-slate-950" : "text-slate-600"
                  }`}
                >
                  {c === "sandbox" ? "Social" : "Email"}
                </button>
              ))}
            </div>
          )}
          {!persist && (
            <div className="flex rounded-lg border border-slate-300 text-xs">
              {(["autonomous", "approval"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 capitalize ${
                    mode === m ? "bg-emerald-500 text-slate-950" : "text-slate-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Type as a customer (Arabic, dialect, Arabizi or English). With “Save to
        workspace” on, conversations appear in the inbox list and analytics live.
      </p>

      <div className="mt-4 min-h-[280px] space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {turns.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            Start by sending a message below 👇
          </p>
        )}
        {turns.map((t, i) => {
          if (t.who === "system")
            return (
              <div key={i} className="text-center text-xs text-rose-600">
                ⚠ {t.body}
              </div>
            );
          const mine = t.who === "customer";
          return (
            <div key={i} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-slate-100 text-slate-900" : "bg-emerald-500 text-slate-950"
                }`}
                dir="auto"
              >
                {t.body}
                {t.who === "ai" && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span className={`rounded border px-1.5 py-0.5 ${decisionStyle[t.result.decision]}`}>
                      {t.result.decision} · {(t.result.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-600">
                      {t.result.analysis.intent}
                    </span>
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-600">
                      {t.result.analysis.language}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && <div className="text-right text-xs text-slate-500">thinking…</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            dir="auto"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            {s.length > 30 ? s.slice(0, 30) + "…" : s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="auto"
          placeholder="Write a customer message…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
        <MicButton disabled={loading} onTranscript={(text) => send(text)} />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
