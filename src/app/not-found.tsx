import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
        404
      </p>
      <h1 className="mt-3 text-4xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-400" dir="auto">
        هذي الصفحة غير موجودة — This page doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Back home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
