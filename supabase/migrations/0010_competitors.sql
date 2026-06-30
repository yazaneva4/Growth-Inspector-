create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  handle text not null,
  platform social_platform not null default 'instagram',
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, platform, handle)
);
alter table competitors enable row level security;
grant select on competitors to anon;
grant select, insert, update, delete on competitors to authenticated;

drop policy if exists comp_manage on competitors;
create policy comp_manage on competitors for all to authenticated
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

drop policy if exists comp_demo_read on competitors;
create policy comp_demo_read on competitors for select
  using (private.is_demo_org(org_id));
