-- Allow anonymous read-only access to the public demo workspace only.
-- Real tenants stay fully isolated by the membership-based policies.
create or replace function is_demo_org(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organizations where id = target and slug = 'demo')
$$;

create policy org_demo_read on organizations for select
  using (slug = 'demo');
create policy conv_demo_read on conversations for select
  using (is_demo_org(org_id));
create policy msg_demo_read on messages for select
  using (is_demo_org(org_id));
create policy esc_demo_read on escalations for select
  using (is_demo_org(org_id));
create policy ca_demo_read on connected_accounts for select
  using (is_demo_org(org_id));
