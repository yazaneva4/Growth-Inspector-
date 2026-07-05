"use client";

/** Friendly in-dashboard recovery UI — replaces the framework's bare
 *  "This page couldn't load" screen when something throws client-side. */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
        Oops
      </p>
      <h1 className="mt-3 text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-slate-500" dir="auto">
        صار خطأ بسيط — جرّب مرة ثانية. A temporary glitch; your data is safe.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Try again
        </button>
        <a
          href="/dashboard/inbox"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Back to inbox
        </a>
      </div>
    </main>
  );
}
