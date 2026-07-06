-- Onboarding profile fields, collected right after signup.
alter table organizations
  add column if not exists owner_full_name text,
  add column if not exists industry text,
  add column if not exists country text not null default 'Saudi Arabia',
  add column if not exists onboarded boolean not null default false;

-- Conversation intelligence: auto-generated titles + AI summary/confidence.
alter table conversations
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists ai_confidence numeric,
  add column if not exists urgency text; -- low | normal | high

create index if not exists conversations_org_urgency on conversations (org_id, urgency);

-- Access-request tables are no longer used by the app (signup is now open,
-- no owner approval) — drop them so the schema matches reality.
drop table if exists access_requests;
