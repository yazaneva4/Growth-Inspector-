-- Security hardening: SECURITY DEFINER onboarding helpers must not remain
-- executable through the PUBLIC role. Keep them available to signed-in users.
revoke execute on function public.accept_pending_invites() from public, anon;
revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.org_teammates() from public, anon;

grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.org_teammates() to authenticated;
