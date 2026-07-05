-- Access requests: a visitor asks to join a workspace by name + email; the
-- workspace owner reviews and approves, which provisions their account. Inserts
-- come from a trusted server route (service role), so no anon insert policy is
-- needed — owners/admins read and decide via their authenticated session.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  status text not null default 'pending', -- pending | approved | rejected
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists access_requests_org_status
  on access_requests (org_id, status, created_at desc);

alter table access_requests enable row level security;
grant select, update on access_requests to authenticated;

drop policy if exists ar_manage on access_requests;
create policy ar_manage on access_requests for all to authenticated
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

-- Live updates on the dashboard, same as every other workspace table.
alter table access_requests replica identity full;
do $$
begin
  alter publication supabase_realtime add table access_requests;
exception when duplicate_object then null; end $$;
