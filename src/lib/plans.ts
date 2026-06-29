import type { PlanTier } from "@/lib/types";

export interface PlanDef {
  tier: PlanTier;
  name: string;
  /** Monthly price in SAR. */
  price: number;
  tagline: string;
  features: string[];
  featured?: boolean;
}

// Pricing model from SPEC §7: per managed-account + per-seat, white-label for
// agencies. SAR amounts are launch placeholders.
export const PLANS: PlanDef[] = [
  {
    tier: "starter",
    name: "Starter",
    price: 149,
    tagline: "Solo professionals & creators",
    features: [
      "Up to 2 connected accounts",
      "Autonomous Arabic + English responder",
      "Intent & sentiment tagging",
      "1 seat",
    ],
  },
  {
    tier: "business",
    name: "Business",
    price: 499,
    tagline: "SMEs & brands",
    featured: true,
    features: [
      "Up to 8 connected accounts",
      "Everything in Starter",
      "Growth Inspector weekly AI report",
      "Lead scoring & escalation queue",
      "Up to 5 team seats",
    ],
  },
  {
    tier: "agency",
    name: "Agency",
    price: 1499,
    tagline: "Agencies managing clients",
    features: [
      "Unlimited connected accounts",
      "Everything in Business",
      "White-label & client sub-workspaces",
      "Per-account + per-seat volume pricing",
      "Priority support",
    ],
  },
];

export const planRank: Record<PlanTier, number> = {
  starter: 0,
  business: 1,
  agency: 2,
};
