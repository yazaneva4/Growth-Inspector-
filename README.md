# Growth Inspector

AI growth platform for the Saudi market. It autonomously answers customers on
social media in **native Arabic dialect + English**, with brand-aware
guardrails, and acts as an always-on growth analyst.

See [`SPEC.md`](./SPEC.md) for the full product & technical vision.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind) — deploy on **Vercel**
- **Supabase** — Postgres, Auth, multi-tenant isolation via Row-Level Security
- **Anthropic Claude** — Sonnet for high-volume replies, Opus for analytics

## What's built

| Area | Where |
|---|---|
| Multi-tenant schema + RLS | `supabase/migrations/0001_init.sql` |
| AI responder (analyze → guardrail → reply → decide) | `src/lib/ai/responder.ts` |
| Ingestion pipeline (inbound → AI → send/escalate) | `src/lib/orchestrator.ts` |
| Platform adapters (sandbox + WhatsApp/Instagram structure) | `src/lib/platforms/adapter.ts` |
| Webhook ingestion | `src/app/api/webhooks/[platform]/route.ts` |
| Live responder demo API (no DB needed) | `src/app/api/simulate/route.ts` |
| Landing + dashboard + live inbox simulator | `src/app/` |

## The responder pipeline

1. **Analyze** — intent, sentiment, language/dialect, lead score, hard-block detection
2. **Guardrail** — politics/religion/legal/medical/pricing → always escalate
3. **Reply** — dialect-matched, brand-voiced response with a self-assessed confidence
4. **Decide** — `send` (autonomous), `draft` (approval mode), or `escalate`
   (low confidence / hot lead / hard-block)

## Run locally

```bash
cp .env.example .env.local   # fill in keys
npm install
npm run dev
```

- With only `ANTHROPIC_API_KEY` set, the **Inbox live demo**
  (`/dashboard/inbox`) works end-to-end — type as a customer in Arabic,
  dialect, Arabizi or English and watch it analyze, decide, and reply.
- Add the Supabase keys to enable auth and the full DB-backed pipeline.

## Environment

See [`.env.example`](./.env.example): Supabase URL/keys, `ANTHROPIC_API_KEY`,
and `META_VERIFY_TOKEN` for webhook verification.

## Roadmap

Phase 1 (foundation + MVP responder) is in place. Next: dialect eval loop,
the Growth Inspector analytics/reports, and live platform adapters
(WhatsApp + Instagram first). See `SPEC.md` §10.
