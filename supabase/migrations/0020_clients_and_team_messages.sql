-- ── CRM clients ───────────────────────────────────────────
-- People who have joined the workspace's CRM. Each row can be greeted with
-- an AI-written WhatsApp thank-you (see /api/clients/welcome).
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,
  phone      text not null,
  company    text,
  created_at timestamptz not null default now()
);
create index if not exists clients_org_id_idx on public.clients (org_id);

alter table public.clients enable row level security;

create policy clients_all on public.clients for all
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

grant select, insert, update, delete on public.clients to authenticated;
grant select on public.clients to anon;

-- ── Internal team chat ─────────────────────────────────────
-- Code-only messaging between the owner and employees of a workspace.
-- No external service — purely Supabase + realtime.
create table if not exists public.team_messages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  author_email text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists team_messages_org_created_idx on public.team_messages (org_id, created_at);

alter table public.team_messages enable row level security;

-- Everyone in the org can read the whole team thread.
create policy team_messages_select on public.team_messages for select
  using (org_id in (select private.auth_org_ids()));

-- You may only post as yourself, into an org you belong to.
create policy team_messages_insert on public.team_messages for insert
  with check (
    org_id in (select private.auth_org_ids())
    and user_id = auth.uid()
  );

grant select, insert on public.team_messages to authenticated;

-- ── Realtime for both new tables ───────────────────────────
alter table public.clients replica identity full;
alter table public.team_messages replica identity full;
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.clients'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.team_messages'; exception when duplicate_object then null; end;
end $$;
