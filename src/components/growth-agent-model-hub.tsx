"use client";

import { GrowthAiChat } from "@/components/growth-ai-chat";

/**
 * Legacy compatibility wrapper. The dashboard uses GrowthAiChat as the single
 * source of truth so the old local-only model hub cannot diverge on failure,
 * realtime deletion, or provider behavior.
 */
export function GrowthAgentModelHub() {
  return <GrowthAiChat />;
}
