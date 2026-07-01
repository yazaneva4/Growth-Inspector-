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

The app is currently pared back to its core: **real auth** and the **backend
responder pipeline**. No dashboard UI is mounted yet.

| Area | Where |
|---|---|
| Multi-tenant schema + RLS | `supabase/migrations/` |
| Email + password auth (sign up / sign in / sign out, Google-ready) | `src/app/login/`, `src/app/auth/` |
| AI responder (analyze → guardrail → reply → decide) | `src/lib/ai/responder.ts` |
| Ingestion pipeline (inbound → AI → send/escalate) | `src/lib/orchestrator.ts` |
| Platform adapters (sandbox, WhatsApp, email) | `src/lib/platforms/adapter.ts` |
| Webhook ingestion | `src/app/api/webhooks/[platform]/route.ts` |
| Public careers / apply page | `src/app/careers/`, `src/app/api/careers/` |
| Integration health check | `src/app/api/health/route.ts` |

## Auth

Email + password is the working login (`/login` → sign up or sign in). Google
sign-in is wired but hidden until you enable the provider in Supabase
**and** set `NEXT_PUBLIC_GOOGLE_ENABLED=true`.

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

## Environment

See [`.env.example`](./.env.example): Supabase URL/keys, `ANTHROPIC_API_KEY`,
`META_VERIFY_TOKEN` for webhook verification, and `NEXT_PUBLIC_GOOGLE_ENABLED`.

## Roadmap

The multi-tenant schema, responder engine, and webhook ingestion are in place.
See `SPEC.md` for the full product vision — a dashboard UI is the next layer
to build on top of this foundation.
