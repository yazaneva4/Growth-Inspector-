# Growth Inspector — Product & Technical Spec

> **One-liner:** A multi-tenant Saudi SaaS that connects a business's social
> accounts, autonomously answers customers in native Arabic dialect + English
> with brand-aware guardrails, and acts as an always-on growth analyst.

Status: **Vision / pre-build.** This document is the plan on paper. No app
code yet.

---

## 1. Problem

Saudi businesses, professionals, and agencies live in social DMs and comments
(WhatsApp, Instagram, X, Snapchat, TikTok). Replying fast, in the right
dialect, around the clock is impossible manually. Generic AI tools fail at
**Saudi Arabic dialect** (Khaleeji/Najdi slang, Arabizi, code-switching),
and none combine front-line response with growth intelligence.

## 2. Customers

| Segment | Who | Pain |
|---|---|---|
| **Starter** | Solo professionals, creators, consultants | Can't keep up with DMs |
| **Business** | SMEs & brands selling via social (e-commerce, clinics, restaurants, real estate, beauty) | Slow replies = lost leads |
| **Agency** | Marketing agencies managing many client accounts | No scalable, branded way to handle client social at volume |

## 3. The Moat

**Native Saudi Arabic dialect data + English.** Growth Inspector understands
and replies in the same register the customer wrote in — formal Arabic,
Khaleeji/Najdi dialect, Arabizi (e.g. "3ndk 7aga?"), English, or
code-switched. This dialect competence is the core differentiator and
compounds as more conversation data is collected.

## 4. Product Scope

### 4.1 MVP — Autonomous DM Responder (build first)
The daily painkiller. Connects a social account and autonomously answers
customer DMs and comments in native Arabic + English, in the brand's voice,
with guardrails.

Core capabilities:
- Unified inbox across connected accounts
- Brand-voice configuration per organization (few-shot examples from the
  customer's own past chats)
- Dialect-aware understanding & generation (Arabic dialects, Arabizi, English,
  code-switching)
- **Guardrail layer** before any auto-send (see §6)
- **Escalation queue** — low-confidence or high-stakes messages routed to a human
- Intent & lead tagging (price inquiry, complaint, hot lead, spam)

### 4.2 Phase 2 — Growth Inspector Intelligence (retention/upsell)
The "wow" layer that earns the name:
- Weekly AI growth reports ("Reels at 9pm post-Isha drove 3x engagement;
  delivery complaints up 40% this week")
- Intent & sentiment analytics across all managed conversations
- **Trend radar** — surface trending KSA hashtags/topics relevant to the brand
- Competitor watch — track competitors' public engagement & content
- Best-time-to-post recommendations (prayer-time / Hijri aware)

### 4.3 Cultural & Local Awareness (cross-cutting)
- Prayer-time-aware scheduling & tone
- Hijri dates, Ramadan campaign awareness
- Never engages political/religious/gender-sensitive topics (hard guardrail)

## 5. Platforms (sequenced by API reality + KSA relevance)

| Phase | Platform | KSA relevance | API reality |
|---|---|---|---|
| 1 | **WhatsApp Business** | Highest (client convos) | Official API; strict 24h window + approved templates |
| 1 | **Instagram** | Very high (brands) | Meta Graph API — solid for DMs & comments |
| 2 | **X / Twitter** | High (public service) | Paid, rate-limited, workable |
| 3 | **Snapchat** | Massive in KSA | Almost no messaging API — likely monitoring/ads only |
| 3 | **TikTok** | Growing | Limited messaging API access |

"All platforms" is the vision; this is the realistic order.

## 6. Autonomy & Guardrails

**Design for full autonomy from day one; ship the dial in a safe position
per client.**

- Build the full autonomous send pipeline AND a guardrail/classifier pass.
- **Confidence threshold:** below it, the AI escalates to a human instead of
  sending.
- **Hard-block topics:** political, religious, gender-sensitive, legal/medical
  advice, pricing commitments beyond policy.
- **Rollout pattern per client:** start in *shadow/approval mode* (AI drafts,
  human approves) → measure quality against an eval set → flip to full
  autonomy once trusted. Same engineering either way; only the dial moves.
- **Why:** one bad auto-reply on X can go viral; dialect misreads can be
  rude/comedic. Reputation risk in KSA is high.

## 7. Business Model

Three tiers, two billing levers, white-label for agencies.

| Tier | Target | Pricing lever | Gating |
|---|---|---|---|
| **Starter** | Solo pros, creators | Per managed-account | 1–2 accounts, capped conversations, core responder |
| **Business** | SMEs & brands | Per managed-account + per-seat | More accounts, Inspector reports, intent scoring, team seats |
| **Agency** | Agencies | Per managed-account **and** per-seat + volume tiers | White-label, client sub-workspaces, priority |

- **Per managed-account** = each connected social account the AI manages.
- **Per-seat** = each human with dashboard access (Business+).
- **White-label** (Agency) = agency's own brand/logo/domain + resold to their
  clients as their own product. Requires theming + custom domains +
  sub-workspaces designed in from the start.
- Localize to **SAR**, local payment (Moyasar/Tap), VAT handling when we reach
  billing.
- Avoid pure per-message pricing early — unpredictable bills scare customers.

## 8. Architecture (for when we build)

```
Social platforms ──webhooks──> Ingestion ──> Unified conversation store
                                                   │
                                                   ▼
                                       Classifier / Guardrail pass
                                                   │
                                   ┌───────────────┴───────────────┐
                                   ▼                               ▼
                          Autonomous responder              Escalation queue
                          (brand voice + dialect)            (human dashboard)
                                   │
                                   ▼
                          Send back to platform
```

- **Frontend / hosting:** Next.js on **Vercel** (connected to this project).
- **Backend / data:** **Supabase** (connected) — Postgres, Auth, Storage,
  Realtime inbox. **Row-Level Security** for multi-tenant isolation
  (organization = tenant).
- **AI brain:** Claude — **Opus** for analysis/reports, **Sonnet** for
  high-volume replies. A cheaper classifier pass gates auto-send.
- **Multi-tenancy:** organization → connected accounts → seats; RLS isolates
  every tenant's data. White-label theming + custom domains as first-class.
- **Per-platform adapters:** webhook ingestion normalized into one
  conversation schema so the responder/analytics are platform-agnostic.

## 9. Compliance & Risk

- **Saudi PDPL** (Personal Data Protection Law) — customer data handling,
  consent, residency considerations.
- **WhatsApp Business API rules** — 24h window, approved message templates;
  violations can ban the number.
- **X / Meta platform policies** — automation limits, rate limits.
- Reputation risk → guardrails + staged autonomy rollout (§6).

## 10. Build Roadmap

1. **Foundation** — Next.js + Supabase auth + multi-tenant org model + dashboard shell.
2. **MVP responder** — connect WhatsApp + Instagram, unified inbox, brand-voice
   config, guardrail pass, autonomous reply with escalation queue.
3. **Quality loop** — dialect eval set from customer data; shadow → autonomous rollout.
4. **Inspector intelligence** — intent analytics, weekly reports, trend radar.
5. **Expand platforms** — X, then Snapchat/TikTok monitoring.
6. **Monetization** — tiers, per-account/per-seat billing, SAR/VAT, white-label for agencies.

---

## Open questions for later

- Where is dialect training/eval data stored and how is it labeled?
- Hosting region / data residency choice for PDPL.
- Payment provider final pick (Moyasar vs Tap vs Stripe).
- Exact price points per tier (SAR).
