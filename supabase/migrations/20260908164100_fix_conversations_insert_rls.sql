alter table public.conversations enable row level security;

create or replace function public.can_access_workspace(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

drop policy if exists "members can insert conversations" on public.conversations;
create policy "members can insert conversations"
on public.conversations
for insert
to authenticated
with check (public.can_access_workspace(org_id));

drop policy if exists "members can select conversations" on public.conversations;
create policy "members can select conversations"
on public.conversations
for select
to authenticated
using (public.can_access_workspace(org_id));

drop policy if exists "members can update conversations" on public.conversations;
create policy "members can update conversations"
on public.conversations
for update
to authenticated
using (public.can_access_workspace(org_id))
with check (public.can_access_workspace(org_id));

grant execute on function public.can_access_workspace(uuid) to authenticated;
