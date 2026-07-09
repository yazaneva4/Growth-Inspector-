/** Instant navigation feedback: Next.js wraps route segments below the
 *  dashboard layout in a Suspense boundary keyed to this file, so a tap on
 *  any nav link shows this skeleton immediately instead of a frozen screen
 *  while the next page's server component resolves. */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-md bg-slate-200" />
          <div className="h-3 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-slate-200 bg-slate-100" />
    </div>
  );
}
