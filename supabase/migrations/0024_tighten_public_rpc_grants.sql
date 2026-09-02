-- SECURITY DEFINER onboarding RPCs should not be callable by PUBLIC.
-- The app explicitly uses them as signed-in operations.

revoke execute on function public.accept_pending_invites() from public;
grant execute on function public.accept_pending_invites() to authenticated;

revoke execute on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

revoke execute on function public.org_teammates() from public;
grant execute on function public.org_teammates() to authenticated;
