-- ── Team invites (per-seat employees) ─────────────────────────
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role member_role not null default 'agent',
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
alter table team_invites enable row level security;
grant select, insert, update, delete on team_invites to authenticated;

-- Org members manage their own org's invites.
drop policy if exists ti_manage on team_invites;
create policy ti_manage on team_invites for all to authenticated
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

-- A user may see invites addressed to their own email (before they join).
drop policy if exists ti_self on team_invites;
create policy ti_self on team_invites for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Close the insecure self-insert policy from 0007; joining is via RPC only.
drop policy if exists mem_insert on memberships;

-- Accept any pending invites for the signed-in user's email.
create or replace function public.accept_pending_invites()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid; uemail text;
begin
  uid := auth.uid();
  if uid is null then return; end if;
  select email into uemail from auth.users where id = uid;
  if uemail is null then return; end if;

  insert into memberships (org_id, user_id, role)
    select ti.org_id, uid, ti.role from team_invites ti
    where lower(ti.email) = lower(uemail) and ti.accepted = false
    on conflict (org_id, user_id) do nothing;

  update team_invites set accepted = true
    where lower(email) = lower(uemail) and accepted = false;
end $$;
grant execute on function public.accept_pending_invites() to authenticated;

-- ── Careers applications (public apply form) ───────────────────
create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  role_interest text,
  message text,
  created_at timestamptz not null default now()
);
alter table job_applications enable row level security;
grant insert on job_applications to anon, authenticated;

-- Anyone can submit; nobody reads them back via the API (service role only).
drop policy if exists ja_insert on job_applications;
create policy ja_insert on job_applications for insert to anon, authenticated
  with check (true);
