// Shared domain types mirroring the Supabase schema (supabase/migrations).

export type PlanTier = "starter" | "business" | "agency";
export type MemberRole = "owner" | "admin" | "agent";
export type SocialPlatform =
  | "whatsapp"
  | "instagram"
  | "x"
  | "snapchat"
  | "tiktok"
  | "sandbox";
export type ConversationStatus = "open" | "escalated" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageAuthor = "customer" | "ai" | "human";
export type ReplyMode = "autonomous" | "approval" | "off";

export type Intent =
  | "price_inquiry"
  | "complaint"
  | "hot_lead"
  | "spam"
  | "support"
  | "other";

export type Language = "ar" | "ar-dialect" | "arabizi" | "en" | "mixed";

export interface BrandVoice {
  /** Short description of how the brand speaks. */
  tone?: string;
  /** Things the AI must never do or say. */
  guardrails?: string[];
  /** Example past replies to imitate (the dialect moat). */
  examples?: { customer: string; reply: string }[];
  /** Business facts the AI may use (hours, returns policy, etc.). */
  facts?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  brand_name: string | null;
  brand_logo_url: string | null;
  custom_domain: string | null;
  brand_voice: BrandVoice;
  reply_mode: ReplyMode;
  confidence_threshold: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  org_id: string;
  account_id: string;
  platform: SocialPlatform;
  customer_handle: string;
  customer_name: string | null;
  status: ConversationStatus;
  intent: Intent | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  language: Language | null;
  lead_score: number | null;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  org_id: string;
  conversation_id: string;
  direction: MessageDirection;
  author: MessageAuthor;
  body: string;
  ai_confidence: number | null;
  ai_meta: Record<string, unknown>;
  delivered: boolean;
  created_at: string;
}
