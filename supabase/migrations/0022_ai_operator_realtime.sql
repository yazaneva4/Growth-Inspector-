-- Persist Growth Operator conversations/messages in Supabase so AI chat is
-- multi-device and realtime instead of browser-local only.

create table if not exists public.ai_operator_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'New conversation',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_operator_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.ai_operator_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  provider text,
  model text,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_operator_conversations_org_updated_idx
  on public.ai_operator_conversations (org_id, updated_at desc);
create index if not exists ai_operator_messages_conversation_created_idx
  on public.ai_operator_messages (conversation_id, created_at);

alter table public.ai_operator_conversations enable row level security;
alter table public.ai_operator_messages enable row level security;

create policy ai_operator_conversations_all on public.ai_operator_conversations
  for all using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

create policy ai_operator_messages_all on public.ai_operator_messages
  for all using (org_id in (select auth_org_ids()))
  with check (org_id in (select auth_org_ids()));

alter table public.ai_operator_conversations replica identity full;
alter table public.ai_operator_messages replica identity full;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.ai_operator_conversations';
  exception when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table public.ai_operator_messages';
  exception when duplicate_object then null;
  end;
end $$;
