-- Track who created each invite so acceptance can never turn an
-- unverified legacy elevated invite into membership.
alter table public.team_invites
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists team_invites_created_by_idx on public.team_invites (created_by);

create or replace function private.set_team_invite_creator()
returns trigger
language plpgsql
security definer
set search_path = public, private as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.created_by := auth.uid();
  return new;
end $$;

revoke all on function private.set_team_invite_creator() from public;
drop trigger if exists team_invite_creator on public.team_invites;
create trigger team_invite_creator
before insert or update on public.team_invites
for each row execute function private.set_team_invite_creator();

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
  if uid is null then return; end if;
  select email into uemail from auth.users where id = uid;
  if uemail is null then return; end if;

  insert into memberships (org_id, user_id, role)
    select ti.org_id, uid, ti.role
    from team_invites ti
    where lower(ti.email) = lower(uemail)
      and ti.accepted = false
      and (
        ti.role = 'agent'
        or (
          ti.created_by is not null
          and exists (
            select 1 from memberships creator
            where creator.org_id = ti.org_id
              and creator.user_id = ti.created_by
              and (
                creator.role = 'owner'
                or (creator.role = 'admin' and ti.role = 'admin')
              )
          )
        )
      )
    on conflict (org_id, user_id) do nothing;

  update team_invites ti
  set accepted = true
  where lower(ti.email) = lower(uemail)
    and ti.accepted = false
    and (
      ti.role = 'agent'
      or (
        ti.created_by is not null
        and exists (
          select 1 from memberships creator
          where creator.org_id = ti.org_id
            and creator.user_id = ti.created_by
            and (creator.role = 'owner' or (creator.role = 'admin' and ti.role = 'admin'))
        )
      )
    );
end $$;

revoke all on function public.accept_pending_invites() from public;
grant execute on function public.accept_pending_invites() to authenticated;
