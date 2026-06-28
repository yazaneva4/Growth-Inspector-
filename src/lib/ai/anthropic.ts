import Anthropic from "@anthropic-ai/sdk";

/**
 * Models per SPEC §8:
 *  - Sonnet for high-volume customer replies (fast, cheap, capable)
 *  - Opus for the Growth Inspector analytics/reports (deeper reasoning)
 */
export const MODELS = {
  reply: "claude-sonnet-4-6",
  analysis: "claude-opus-4-8",
} as const;

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
