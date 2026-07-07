import { GrowthAgent } from "@/components/growth-agent";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Growth in Brilliance</h1>
      <p className="mt-1 text-sm text-slate-500">
        Give it a goal in plain English — it autonomously checks your analytics,
        competitors, and trend radar, then reports back with a concrete answer.
      </p>

      <div className="mt-6">
        <GrowthAgent />
      </div>

      {!process.env.GEMINI_API_KEY && (
        <p className="mt-4 text-xs text-amber-600">
          Add GEMINI_API_KEY to enable Growth in Brilliance (free tier available
          at aistudio.google.com).
        </p>
      )}
    </div>
  );
}
