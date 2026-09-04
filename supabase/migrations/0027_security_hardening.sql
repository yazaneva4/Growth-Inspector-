-- Growth Inspector security hardening.
-- Forward-only migration: do not rewrite already-applied migrations.

-- Repair existing cross-tenant parent references before enforcing the new
-- composite relationships. Conversation ownership follows its connected
-- account; child rows follow their conversation.
update public.conversations c
set org_id = a.org_id
from public.connected_accounts a
where a.id = c.account_id
  and c.org_id <> a.org_id;

update public.messages m
set org_id = c.org_id
from public.conversations c
where c.id = m.conversation_id
  and m.org_id <> c.org_id;

update public.escalations e
set org_id = c.org_id
from public.conversations c
where c.id = e.conversation_id
  and e.org_id <> c.org_id;

update public.ai_operator_messages m
set org_id = c.org_id
from public.ai_operator_conversations c
where c.id = m.conversation_id
  and m.org_id <> c.org_id;

-- Trusted role checks for invite management. These functions are private and
-- SECURITY DEFINER so policies can inspect memberships without recursive RLS.
create or replace function private.is_org_owner_or_admin(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
$$;

create or replace function private.can_manage_team_invite(p_org_id uuid, p_role member_role)
returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and (
        m.role = 'owner'
        or (m.role = 'admin' and p_role in ('admin', 'agent'))
      )
  )
$$;

revoke all on function private.is_org_owner_or_admin(uuid) from public;
revoke all on function private.can_manage_team_invite(uuid, member_role) from public;
grant execute on function private.is_org_owner_or_admin(uuid) to authenticated;
grant execute on function private.can_manage_team_invite(uuid, member_role) to authenticated;

drop policy if exists ti_manage on public.team_invites;
create policy ti_manage on public.team_invites for all to authenticated
  using (private.is_org_owner_or_admin(org_id))
  with check (private.can_manage_team_invite(org_id, role));

-- Rebuild invite acceptance from the trusted invite rows. The RPC itself is
-- not a role-granting endpoint: it only consumes invites that passed the
-- owner/admin policy at creation/update time.
create or replace function public.accept_pending_invites()
returns void
language plpgsql
security definer
set search_path = public, private as $$
declare
  uid uuid;
  uemail text;
begin
  uid := auth.uid();
  if uid is null then
    return;
  end if;

  select email into uemail from auth.users where id = uid;
  if uemail is null then
    return;
  end if;

  insert into memberships (org_id, user_id, role)
    select ti.org_id, uid, ti.role
    from team_invites ti
    where lower(ti.email) = lower(uemail)
      and ti.accepted = false
      and ti.role in ('owner', 'admin', 'agent')
    on conflict (org_id, user_id) do nothing;

  update team_invites
  set accepted = true
  where lower(email) = lower(uemail)
    and accepted = false;
end $$;

revoke all on function public.accept_pending_invites() from public;
grant execute on function public.accept_pending_invites() to authenticated;

-- Assignment-aware writes: agents can only mutate conversations they can see.
drop policy if exists msg_write on public.messages;
create policy msg_write on public.messages for insert to authenticated
  with check (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update to authenticated
  using (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  )
  with check (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

drop policy if exists msg_delete on public.messages;
create policy msg_delete on public.messages for delete to authenticated
  using (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

drop policy if exists esc_write on public.escalations;
create policy esc_write on public.escalations for insert to authenticated
  with check (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

drop policy if exists esc_update on public.escalations;
create policy esc_update on public.escalations for update to authenticated
  using (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  )
  with check (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

drop policy if exists esc_delete on public.escalations;
create policy esc_delete on public.escalations for delete to authenticated
  using (
    org_id in (select private.auth_org_ids())
    and private.can_see_conversation(conversation_id)
  );

-- Composite uniqueness gives PostgreSQL a stable parent key for same-tenant
-- foreign keys.
create unique index if not exists connected_accounts_id_org_id_key
  on public.connected_accounts (id, org_id);
create unique index if not exists conversations_id_org_id_key
  on public.conversations (id, org_id);
create unique index if not exists ai_operator_conversations_id_org_id_key
  on public.ai_operator_conversations (id, org_id);

-- Future writes must keep every child in the same tenant as its parent.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_account_org_fk') then
    alter table public.conversations
      add constraint conversations_account_org_fk
      foreign key (account_id, org_id)
      references public.connected_accounts (id, org_id)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'messages_conversation_org_fk') then
    alter table public.messages
      add constraint messages_conversation_org_fk
      foreign key (conversation_id, org_id)
      references public.conversations (id, org_id)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'escalations_conversation_org_fk') then
    alter table public.escalations
      add constraint escalations_conversation_org_fk
      foreign key (conversation_id, org_id)
      references public.conversations (id, org_id)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ai_operator_messages_conversation_org_fk') then
    alter table public.ai_operator_messages
      add constraint ai_operator_messages_conversation_org_fk
      foreign key (conversation_id, org_id)
      references public.ai_operator_conversations (id, org_id)
      not valid;
  end if;
end $$;

-- A conversation must use the same platform as its connected account.
create or replace function private.enforce_conversation_account_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, private as $$
declare
  account_platform social_platform;
  account_org uuid;
begin
  select platform, org_id into account_platform, account_org
  from connected_accounts
  where id = new.account_id;

  if account_org is null then
    raise exception 'connected account not found';
  end if;
  if new.org_id <> account_org then
    raise exception 'conversation account must belong to the same organization';
  end if;
  if new.platform <> account_platform then
    raise exception 'conversation platform must match connected account platform';
  end if;
  return new;
end $$;

revoke all on function private.enforce_conversation_account_consistency() from public;
create or replace trigger conversations_account_consistency
before insert or update of account_id, org_id, platform on public.conversations
for each row execute function private.enforce_conversation_account_consistency();

-- Concurrency-safe onboarding. A transaction-scoped advisory lock serializes
-- calls for one authenticated user; the second caller then observes the
-- membership created by the first and returns it.
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public, private as $$
declare
  uid uuid;
  new_id uuid;
  base_slug text;
  final_slug text;
  n int := 0;
  existing uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select org_id into existing
  from memberships
  where user_id = uid
  order by created_at
  limit 1;
  if existing is not null then
    return existing;
  end if;

  base_slug := regexp_replace(lower(coalesce(nullif(trim(org_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' or base_slug = 'demo' then
    base_slug := 'workspace';
  end if;

  loop
    final_slug := case when n = 0 then base_slug else base_slug || '-' || n end;
    begin
      insert into organizations (name, slug)
      values (coalesce(nullif(trim(org_name), ''), 'My Workspace'), final_slug)
      returning id into new_id;
      exit;
    exception when unique_violation then
      n := n + 1;
    end;
  end loop;

  insert into memberships (org_id, user_id, role)
  values (new_id, uid, 'owner');
  return new_id;
end $$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

-- Never trust the client-provided team-message author email. Resolve it from
-- the authenticated user on every write.
create or replace function private.set_team_message_author_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private as $$
declare
  resolved_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.user_id := auth.uid();
  select email into resolved_email from auth.users where id = auth.uid();
  new.author_email := coalesce(resolved_email, '');
  if new.author_email = '' then
    raise exception 'authenticated user has no email';
  end if;
  return new;
end $$;

revoke all on function private.set_team_message_author_identity() from public;
create or replace trigger team_messages_author_identity
before insert or update on public.team_messages
for each row execute function private.set_team_message_author_identity();
