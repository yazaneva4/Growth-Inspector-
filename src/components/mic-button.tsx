"use client";

import { useRef, useState } from "react";

/** Records mic audio, transcribes it via /api/voice-chat/transcribe, and
 *  hands the text back through onTranscript. Self-contained — no external
 *  state needed from the parent besides the callback. */
export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "voice-chat.webm");
          const res = await fetch("/api/voice-chat/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Transcription failed");
          if (data.text?.trim()) onTranscript(data.text.trim());
          else setError("Didn't catch that — try again.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setState("idle");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || state === "transcribing"}
        onClick={state === "recording" ? stop : start}
        title={state === "recording" ? "Stop recording" : "Speak instead"}
        aria-label={state === "recording" ? "Stop recording" : "Speak instead"}
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border text-sm transition-colors disabled:opacity-50 ${
          state === "recording"
            ? "animate-pulse border-rose-500 bg-rose-500/10 text-rose-600"
            : "border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
      >
        {state === "transcribing" ? "…" : state === "recording" ? "⏹" : "🎤"}
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1 w-48 text-right text-[10px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
