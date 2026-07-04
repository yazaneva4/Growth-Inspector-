-- Invoices a workspace sends to its customers (SAR + 15% Saudi VAT),
-- emailed via Resend and listed live on the dashboard.
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  number text not null,
  customer_name text not null,
  customer_email text not null,
  items jsonb not null default '[]'::jsonb, -- [{description, qty, unit_price}]
  subtotal numeric not null default 0,
  vat numeric not null default 0,
  total numeric not null default 0,
  currency text not null default 'SAR',
  status text not null default 'draft',     -- draft | sent | paid
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, number)
);
create index if not exists invoices_org_created on invoices (org_id, created_at desc);

alter table invoices enable row level security;
grant select, insert, update, delete on invoices to authenticated;
grant select on invoices to anon;

drop policy if exists inv_manage on invoices;
create policy inv_manage on invoices for all to authenticated
  using (org_id in (select private.auth_org_ids()))
  with check (org_id in (select private.auth_org_ids()));

drop policy if exists inv_demo_read on invoices;
create policy inv_demo_read on invoices for select
  using (private.is_demo_org(org_id));

-- Live updates on the dashboard, same as conversations/messages/escalations.
alter table invoices replica identity full;
do $$
begin
  alter publication supabase_realtime add table invoices;
exception when duplicate_object then null; end $$;
