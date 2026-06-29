-- Secure, idempotent onboarding: create an org + owner membership for the
-- calling user. SECURITY DEFINER so it can insert despite RLS, but it only ever
-- acts for auth.uid(), so a user can only ever create/return their own org.
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  base_slug text;
  final_slug text;
  n int := 0;
  existing uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotent: if the user already belongs to an org, return it.
  select org_id into existing from memberships where user_id = auth.uid() limit 1;
  if existing is not null then
    return existing;
  end if;

  base_slug := regexp_replace(lower(coalesce(nullif(trim(org_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' or base_slug = 'demo' then base_slug := 'workspace'; end if;
  final_slug := base_slug;
  while exists (select 1 from organizations where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n;
  end loop;

  insert into organizations (name, slug) values (coalesce(nullif(trim(org_name), ''), 'My Workspace'), final_slug)
    returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

grant execute on function public.create_organization(text) to authenticated;

-- Members may insert their own membership row (onboarding uses the RPC above).
drop policy if exists mem_insert on memberships;
create policy mem_insert on memberships for insert to authenticated
  with check (user_id = auth.uid());
