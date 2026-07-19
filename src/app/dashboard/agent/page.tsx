import { GrowthAgent } from "@/components/growth-agent";
import { geminiConfigured } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Growth Operator ⭐</h1>
      <p className="mt-1 text-sm text-slate-500">
        Give it a goal in plain English — it autonomously checks your analytics,
        competitors, and trend radar, and can take action too: send an email
        or open a WhatsApp message for you. It reports back and checks in on
        how it went.
      </p>

      <div className="mt-6">
        <GrowthAgent />
      </div>

      {!geminiConfigured() && (
        <p className="mt-4 text-xs text-amber-600">
          Add GOOGLE_API_KEY (or GEMINI_API_KEY) to enable Growth Operator
          (free tier available at aistudio.google.com).
        </p>
      )}
    </div>
  );
}
