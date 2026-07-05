/** Lightweight, dependency-free chart primitives for the dashboards. */

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-emerald-400">{sub}</div>}
    </div>
  );
}

const BAR_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
];

export function BarList({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-slate-600" title={it.label}>
            {it.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-slate-500">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SentimentBar({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = Math.max(1, positive + neutral + negative);
  const seg = [
    { v: positive, c: "bg-emerald-500", label: "positive" },
    { v: neutral, c: "bg-slate-500", label: "neutral" },
    { v: negative, c: "bg-rose-500", label: "negative" },
  ];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {seg.map((s) => (
          <div
            key={s.label}
            className={s.c}
            style={{ width: `${(s.v / total) * 100}%` }}
            title={`${s.label}: ${s.v}`}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        {seg.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${s.c}`} />
            {s.label} {s.v}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-emerald-500">{title}</h2>
      {children}
    </div>
  );
}
