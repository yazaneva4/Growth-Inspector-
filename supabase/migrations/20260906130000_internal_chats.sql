-- Internal Growth Inspector chats: personal and custom group conversations.
create type chat_kind as enum ('personal', 'group');

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind chat_kind not null,
  title text,
  direct_key text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, direct_key)
);

create table chat_participants (
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index chat_conversations_org_updated_idx on chat_conversations (org_id, updated_at desc);
create index chat_participants_user_idx on chat_participants (user_id, conversation_id);
create index chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

create or replace function list_chat_members()
returns table (user_id uuid, email text, name text, role member_role)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id,
         coalesce(u.email, '')::text,
         coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1))::text,
         m.role
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id in (select auth_org_ids())
  order by lower(coalesce(u.email, ''))
$$;

create or replace function is_chat_participant(target_conversation uuid, target_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from chat_participants
    where conversation_id = target_conversation and user_id = target_user
  );
$$;

alter table chat_conversations enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages enable row level security;

create policy chat_conv_member_select on chat_conversations for select
  using (org_id in (select auth_org_ids()) and is_chat_participant(id));
create policy chat_conv_member_insert on chat_conversations for insert
  with check (org_id in (select auth_org_ids()) and created_by = auth.uid());
create policy chat_conv_member_update on chat_conversations for update
  using (org_id in (select auth_org_ids()) and is_chat_participant(id))
  with check (org_id in (select auth_org_ids()));

create policy chat_participant_member_select on chat_participants for select
  using (is_chat_participant(conversation_id));
create policy chat_participant_creator_insert on chat_participants for insert
  with check (exists (
    select 1 from chat_conversations c where c.id = conversation_id and c.org_id in (select auth_org_ids())
  ));

create policy chat_message_member_select on chat_messages for select
  using (org_id in (select auth_org_ids()) and is_chat_participant(conversation_id));
create policy chat_message_member_insert on chat_messages for insert
  with check (
    org_id in (select auth_org_ids())
    and author_id = auth.uid()
    and is_chat_participant(conversation_id)
  );

alter table chat_messages replica identity full;
alter table chat_conversations replica identity full;

-- Realtime payloads are intentionally limited to internal chat tables.
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_conversations;
