import { GrowthAgentModelHub } from "@/components/growth-agent-model-hub";
import { SparkleIcon } from "@/components/sparkle-icon";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        Growth Operator <SparkleIcon className="text-2xl" />
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        A real AI growth teammate with conversations, tools, model selection,
        and live provider availability across GPT, Anthropic, z.ai, and Google Gemini.
      </p>
      <div className="mt-6">
        <GrowthAgentModelHub />
      </div>
    </div>
  );
}
