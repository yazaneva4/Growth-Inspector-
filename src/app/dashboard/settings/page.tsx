import { HARD_BLOCK_TOPICS } from "@/lib/ai/responder";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Brand voice</h1>
      <p className="mt-1 text-sm text-slate-400">
        This is how Growth Inspector speaks for you. Your past replies (the
        dialect moat) are used as few-shot examples so the AI matches your tone.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Tone" placeholder="Warm, professional, light Khaleeji dialect" />
        <Field
          label="Business facts the AI may use"
          placeholder="Hours, delivery times, return policy, product list…"
          textarea
        />
        <Field
          label="Reply mode"
          placeholder="autonomous · approval · off"
        />
        <Field label="Confidence threshold" placeholder="0.75" />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-rose-300">
          Always escalated to a human
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-400">
          {HARD_BLOCK_TOPICS.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Saving persists to the organization record (Supabase). Wiring the form
        action is the next step once your project is connected.
      </p>
    </div>
  );
}

function Field({
  label,
  placeholder,
  textarea,
}: {
  label: string;
  placeholder: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      ) : (
        <input
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      )}
    </label>
  );
}
