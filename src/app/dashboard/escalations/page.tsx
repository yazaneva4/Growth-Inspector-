export default function EscalationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Escalations</h1>
      <p className="mt-1 text-sm text-slate-400">
        Conversations the AI handed to a human — low confidence, high-intent
        leads, or hard-block topics (politics, religion, legal/medical, pricing
        commitments). These never auto-send.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">
        No escalations yet. They appear here automatically once accounts are
        connected and live traffic flows in.
      </div>
    </div>
  );
}
