-- Align AI Operator RLS with the live database: add the missing FK index,
-- consolidate duplicate demo/workspace policies, and keep privileged onboarding
-- RPCs unavailable to anonymous/signed-in callers unless explicitly granted later.

create index if not exists ai_operator_messages_org_id_idx
  on public.ai_operator_messages (org_id);

drop policy if exists ai_operator_conversations_all on public.ai_operator_conversations;
drop policy if exists ai_operator_conversations_demo_delete on public.ai_operator_conversations;
drop policy if exists ai_operator_conversations_demo_read on public.ai_operator_conversations;
drop policy if exists ai_operator_conversations_demo_update on public.ai_operator_conversations;
drop policy if exists ai_operator_conversations_demo_write on public.ai_operator_conversations;

create policy ai_operator_conversations_access on public.ai_operator_conversations
  for all
  using (
    org_id in (select private.auth_org_ids())
    or private.is_demo_org(org_id)
  )
  with check (
    org_id in (select private.auth_org_ids())
    or private.is_demo_org(org_id)
  );

drop policy if exists ai_operator_messages_all on public.ai_operator_messages;
drop policy if exists ai_operator_messages_demo_read on public.ai_operator_messages;
drop policy if exists ai_operator_messages_demo_write on public.ai_operator_messages;

create policy ai_operator_messages_access on public.ai_operator_messages
  for all
  using (
    org_id in (select private.auth_org_ids())
    or private.is_demo_org(org_id)
  )
  with check (
    org_id in (select private.auth_org_ids())
    or private.is_demo_org(org_id)
  );

revoke execute on function public.accept_pending_invites() from anon, authenticated;
revoke execute on function public.create_organization(text) from anon, authenticated;
revoke execute on function public.org_teammates() from anon, authenticated;
