-- When an owner invites an email that already has a Growth Inspector account,
-- immediately create the membership and mark the invite as accepted. This fixes
-- invites remaining Pending when the employee is already signed in.
create or replace function public.accept_existing_team_invite(p_org_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  target_user uuid;
  normalized_email text;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'authentication required';
  end if;

  normalized_email := lower(trim(p_email));
  if normalized_email = '' then
    raise exception 'email required';
  end if;

  -- Only an existing member of the target workspace may trigger this action.
  if not exists (
    select 1
    from memberships m
    where m.org_id = p_org_id
      and m.user_id = caller
  ) then
    raise exception 'not a workspace member';
  end if;

  select id into target_user
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if target_user is null then
    return;
  end if;

  insert into memberships (org_id, user_id, role)
    select ti.org_id, target_user, ti.role
    from team_invites ti
    where ti.org_id = p_org_id
      and lower(ti.email) = normalized_email
      and ti.accepted = false
    on conflict (org_id, user_id) do nothing;

  update team_invites
  set accepted = true
  where org_id = p_org_id
    and lower(email) = normalized_email
    and accepted = false;
end;
$$;

grant execute on function public.accept_existing_team_invite(uuid, text) to authenticated;
