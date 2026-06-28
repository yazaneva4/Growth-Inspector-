-- Let the anonymous role write to the public demo workspace only, so the
-- live inbox demo can persist conversations/messages/escalations. Real
-- tenants write via the authenticated role under the membership policies.
grant insert, update on conversations, messages, escalations to anon;

create policy conv_demo_write on conversations for insert
  with check (is_demo_org(org_id));
create policy conv_demo_update on conversations for update
  using (is_demo_org(org_id)) with check (is_demo_org(org_id));

create policy msg_demo_write on messages for insert
  with check (is_demo_org(org_id));

create policy esc_demo_write on escalations for insert
  with check (is_demo_org(org_id));
