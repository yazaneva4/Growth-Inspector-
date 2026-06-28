-- Move RLS helper functions out of the API-exposed public schema so they are
-- not callable via /rest/v1/rpc, clearing the security-advisor warnings.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.auth_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid()
$$;

create or replace function private.is_demo_org(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations where id = target and slug = 'demo')
$$;

grant execute on function private.auth_org_ids() to anon, authenticated;
grant execute on function private.is_demo_org(uuid) to anon, authenticated;

-- Recreate every policy to reference the private functions.
drop policy if exists org_select on organizations;
drop policy if exists org_update on organizations;
create policy org_select on organizations for select
  using (id in (select private.auth_org_ids()));
create policy org_update on organizations for update
  using (id in (select private.auth_org_ids()));

drop policy if exists mem_select on memberships;
create policy mem_select on memberships for select
  using (org_id in (select private.auth_org_ids()));

drop policy if exists ca_all on connected_accounts;
create policy ca_all on connected_accounts for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

drop policy if exists conv_all on conversations;
create policy conv_all on conversations for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

drop policy if exists msg_all on messages;
create policy msg_all on messages for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

drop policy if exists esc_all on escalations;
create policy esc_all on escalations for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

-- Demo read/write policies.
drop policy if exists ca_demo_read on connected_accounts;
create policy ca_demo_read on connected_accounts for select
  using (private.is_demo_org(org_id));

drop policy if exists conv_demo_read on conversations;
create policy conv_demo_read on conversations for select
  using (private.is_demo_org(org_id));
drop policy if exists conv_demo_write on conversations;
create policy conv_demo_write on conversations for insert
  with check (private.is_demo_org(org_id));
drop policy if exists conv_demo_update on conversations;
create policy conv_demo_update on conversations for update
  using (private.is_demo_org(org_id)) with check (private.is_demo_org(org_id));

drop policy if exists msg_demo_read on messages;
create policy msg_demo_read on messages for select
  using (private.is_demo_org(org_id));
drop policy if exists msg_demo_write on messages;
create policy msg_demo_write on messages for insert
  with check (private.is_demo_org(org_id));

drop policy if exists esc_demo_read on escalations;
create policy esc_demo_read on escalations for select
  using (private.is_demo_org(org_id));
drop policy if exists esc_demo_write on escalations;
create policy esc_demo_write on escalations for insert
  with check (private.is_demo_org(org_id));

-- Drop the now-unreferenced public functions exposed via the API.
drop function if exists public.auth_org_ids();
drop function if exists public.is_demo_org(uuid);
