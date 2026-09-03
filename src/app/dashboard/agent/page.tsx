import { GrowthAiChat } from "@/components/growth-ai-chat";
import { SparkleIcon } from "@/components/sparkle-icon";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="growth-ai-page max-w-6xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        Growth AI <SparkleIcon className="text-2xl" />
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        A real AI growth teammate with saved conversations, durable conversation memory,
        model switching, tools, live provider availability, and local/cloud execution.
      </p>
      <div className="mt-6">
        <GrowthAiChat />
      </div>
    </div>
  );
}
