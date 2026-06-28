# Deploying Growth Inspector to Vercel

The app is build-ready. Deployment needs your Vercel account (it can't be done
from the agent sandbox — no Vercel auth token here).

## Option A — Git integration (recommended, one-time)

1. Go to https://vercel.com/new and **import** the GitHub repo
   `yazaneva4/growth-inspector-`.
2. Vercel auto-detects Next.js — no build settings needed.
3. Add the environment variables below, then **Deploy**.
4. Every push to the branch then deploys automatically.

## Option B — Vercel CLI (from your machine)

```bash
npm i -g vercel
vercel link          # pick/create the project
vercel env add ...   # add the variables below (or set them in the dashboard)
vercel --prod
```

## Option C — GitHub Actions (in this repo)

`.github/workflows/deploy.yml` deploys to Vercel on push. To enable it:

1. Create a Vercel token: https://vercel.com/account/tokens
2. Run `vercel link` once locally to generate `.vercel/project.json`, which
   contains `orgId` and `projectId`.
3. In GitHub → **Settings → Secrets and variables → Actions**, add secrets:
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
4. Add a repo **variable** `ENABLE_VERCEL_DEPLOY` = `true` (the workflow skips
   cleanly until this is set, so CI stays green meanwhile).
5. Set the app env vars (below) in the **Vercel project settings**.

`.github/workflows/ci.yml` runs lint + build on every push regardless.

## Environment variables

| Variable | Secret? | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | `https://ttjzmmqalbfeybysmqko.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (publishable) | `sb_publishable_LztXbrEa4Evw12Iehs4H5A_ivQU-ZOz` |
| `ANTHROPIC_API_KEY` | **yes** | your Anthropic key — enables the responder + the AI report |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | from Supabase → Project Settings → API → service_role (only needed for live platform webhook ingestion; the demo uses the publishable key) |
| `META_VERIFY_TOKEN` | yes | any string; must match your Meta webhook config |

The two `NEXT_PUBLIC_*` values are safe to expose — the publishable key is
protected by Row-Level Security. The dashboards work with just those two; the
inbox responder and AI report light up once `ANTHROPIC_API_KEY` is set.

## After deploy

- `/dashboard` and `/dashboard/analytics` render the demo workspace immediately.
- In `/dashboard/inbox`, toggle **Save to workspace** to persist a live
  conversation — it appears in the Inspector report.
