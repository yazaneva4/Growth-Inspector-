export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {description ?? "This section is on the roadmap and isn't built yet."}
      </p>
    </div>
  );
}
