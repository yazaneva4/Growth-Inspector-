"use client";

import { useEffect, useRef, useState } from "react";

export function MicButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    stopStream();
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopStream();
        throw new Error("This browser cannot record microphone audio.");
      }

      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        recorderRef.current = null;
        stopStream();
        setState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "voice-chat.webm");
          const res = await fetch("/api/voice-chat/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error ?? "Transcription failed");
          if (data?.text?.trim()) onTranscript(data.text.trim());
          else setError("Didn't catch that — try again.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          stopStream();
          setState("idle");
        }
      };

      try {
        recorder.start();
      } catch {
        recorderRef.current = null;
        stopStream();
        throw new Error("Could not start microphone recording.");
      }
      setState("recording");
    } catch (err) {
      stopStream();
      setState("idle");
      setError(err instanceof Error ? err.message : "Microphone access denied or unavailable.");
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder) { stopStream(); return; }
    try { recorder.stop(); } catch { recorderRef.current = null; stopStream(); setState("idle"); }
  }

  return (
    <div className="relative">
      <button type="button" disabled={disabled || state === "transcribing"} onClick={state === "recording" ? stop : start}
        title={state === "recording" ? "Stop recording" : "Speak instead"}
        aria-label={state === "recording" ? "Stop recording" : "Speak instead"}
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border text-sm transition-colors disabled:opacity-50 ${state === "recording" ? "animate-pulse border-rose-500 bg-rose-500/10 text-rose-600" : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
        {state === "transcribing" ? "…" : state === "recording" ? "⏹" : "🎤"}
      </button>
      {error && <p className="absolute right-0 top-full mt-1 w-48 text-right text-[10px] text-rose-600">{error}</p>}
    </div>
  );
}
