-- Backup contacts: a short list of name/phone entries per workspace, shown
-- beside the inbox so the team knows who to call if the AI is ever
-- unavailable.
create table backup_contacts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,
  phone      text not null,
  created_at timestamptz not null default now()
);
create index on backup_contacts (org_id);

alter table backup_contacts enable row level security;

create policy backup_contacts_all on backup_contacts for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

-- RLS alone isn't enough — PostgREST also needs the base table grant,
-- same as every other per-org table (e.g. connected_accounts).
grant select, insert, update, delete on backup_contacts to authenticated;
grant select on backup_contacts to anon;
