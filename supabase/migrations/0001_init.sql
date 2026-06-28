-- Growth Inspector — initial multi-tenant schema
-- Tenants = organizations. Every row is isolated by org via RLS.

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
create type plan_tier as enum ('starter', 'business', 'agency');
create type member_role as enum ('owner', 'admin', 'agent');
create type social_platform as enum ('whatsapp', 'instagram', 'x', 'snapchat', 'tiktok', 'sandbox');
create type conversation_status as enum ('open', 'escalated', 'closed');
create type message_direction as enum ('inbound', 'outbound');
create type message_author as enum ('customer', 'ai', 'human');
create type reply_mode as enum ('autonomous', 'approval', 'off');

-- ─────────────────────────────────────────────────────────────
-- Organizations (tenants)
-- ─────────────────────────────────────────────────────────────
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  plan        plan_tier not null default 'starter',
  -- white-label (agency tier)
  brand_name  text,
  brand_logo_url text,
  custom_domain  text,
  -- brand voice config used by the AI responder
  brand_voice    jsonb not null default '{}'::jsonb,
  reply_mode     reply_mode not null default 'approval',
  confidence_threshold numeric not null default 0.75,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Membership / seats — links auth.users to an org with a role
-- ─────────────────────────────────────────────────────────────
create table memberships (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organizations(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      member_role not null default 'agent',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Helper: orgs the current user belongs to. SECURITY DEFINER avoids
-- recursive RLS evaluation when policies reference memberships.
create or replace function auth_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────
-- Connected social accounts (a managed-account = billing unit)
-- ─────────────────────────────────────────────────────────────
create table connected_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  platform    social_platform not null,
  external_id text not null,             -- platform handle / page / phone id
  display_name text not null,
  -- platform tokens/secrets live in vault in prod; placeholder here
  credentials jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (platform, external_id)
);

-- ─────────────────────────────────────────────────────────────
-- Conversations
-- ─────────────────────────────────────────────────────────────
create table conversations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  account_id   uuid not null references connected_accounts(id) on delete cascade,
  platform     social_platform not null,
  customer_handle text not null,
  customer_name   text,
  status       conversation_status not null default 'open',
  -- AI-derived signals
  intent       text,                     -- price_inquiry | complaint | hot_lead | spam | other
  sentiment    text,                     -- positive | neutral | negative
  language     text,                     -- ar | ar-dialect | arabizi | en | mixed
  lead_score   int,                      -- 0-100
  last_message_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index on conversations (org_id, last_message_at desc);
create index on conversations (org_id, status);

-- ─────────────────────────────────────────────────────────────
-- Messages
-- ─────────────────────────────────────────────────────────────
create table messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction       message_direction not null,
  author          message_author not null,
  body            text not null,
  -- AI metadata for outbound drafts/sends
  ai_confidence   numeric,
  ai_meta         jsonb not null default '{}'::jsonb,
  delivered       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Escalations — low-confidence / hard-block messages for humans
-- ─────────────────────────────────────────────────────────────
create table escalations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason          text not null,          -- low_confidence | hard_block_topic | high_intent
  draft           text,                   -- AI suggested reply, if any
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on escalations (org_id, resolved);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security — every table isolated by org membership
-- ─────────────────────────────────────────────────────────────
alter table organizations     enable row level security;
alter table memberships       enable row level security;
alter table connected_accounts enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table escalations       enable row level security;

-- Organizations: members can see/manage their own org
create policy org_select on organizations for select
  using (id in (select auth_org_ids()));
create policy org_update on organizations for update
  using (id in (select auth_org_ids()));

-- Memberships: a user can see memberships of orgs they belong to
create policy mem_select on memberships for select
  using (org_id in (select auth_org_ids()));

-- Generic per-org tables
create policy ca_all on connected_accounts for all
  using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

create policy conv_all on conversations for all
  using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

create policy msg_all on messages for all
  using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

create policy esc_all on escalations for all
  using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));
