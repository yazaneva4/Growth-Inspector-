-- Per-teammate conversation isolation: within the same org, a regular
-- agent should only see conversations assigned to them (or not yet
-- claimed by anyone); owners/admins keep full visibility to oversee
-- the team. Unassigned conversations stay visible to every agent so
-- they can pick them up — nothing becomes permanently invisible.

alter table conversations
  add column assigned_to uuid references auth.users(id) on delete set null;

create index on conversations (org_id, assigned_to);

-- SECURITY DEFINER, private schema (not RPC-exposed) — same pattern as
-- private.auth_org_ids(): bypasses RLS internally so the policy check
-- itself doesn't recurse through conversations' own RLS.
create or replace function private.can_see_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from conversations c
    join memberships m on m.org_id = c.org_id and m.user_id = auth.uid()
    where c.id = p_conversation_id
      and (
        c.assigned_to is null
        or c.assigned_to = auth.uid()
        or m.role in ('owner', 'admin')
      )
  )
$$;

grant execute on function private.can_see_conversation(uuid) to authenticated;

-- Public RPC so the inbox UI can list assignable teammates without
-- exposing all of auth.users — scoped to orgs the caller belongs to.
create or replace function public.org_teammates()
returns table (user_id uuid, email text, role member_role)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email, m.role
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id in (select private.auth_org_ids())
$$;

grant execute on function public.org_teammates() to authenticated;

drop policy conv_all on conversations;

create policy conv_select on conversations for select
  using (org_id in (select private.auth_org_ids()) and private.can_see_conversation(id));

create policy conv_insert on conversations for insert
  with check (org_id in (select private.auth_org_ids()));

create policy conv_update on conversations for update
  using (org_id in (select private.auth_org_ids()) and private.can_see_conversation(id))
  with check (org_id in (select private.auth_org_ids()));

create policy conv_delete on conversations for delete
  using (org_id in (select private.auth_org_ids()) and private.can_see_conversation(id));

drop policy msg_all on messages;

create policy msg_select on messages for select
  using (org_id in (select private.auth_org_ids()) and private.can_see_conversation(conversation_id));

create policy msg_write on messages for insert
  with check (org_id in (select private.auth_org_ids()));

create policy msg_update on messages for update
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

create policy msg_delete on messages for delete
  using (org_id in (select private.auth_org_ids()));

drop policy esc_all on escalations;

create policy esc_select on escalations for select
  using (org_id in (select private.auth_org_ids()) and private.can_see_conversation(conversation_id));

create policy esc_write on escalations for insert
  with check (org_id in (select private.auth_org_ids()));

create policy esc_update on escalations for update
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

create policy esc_delete on escalations for delete
  using (org_id in (select private.auth_org_ids()));
