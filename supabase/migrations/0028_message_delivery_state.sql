-- Explicit delivery state prevents an outbound message from looking sent
-- before the platform adapter has accepted it.
alter table public.messages
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_error text,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists delivered_at timestamptz;

update public.messages
set delivery_status = case
  when direction = 'outbound' and delivered = true then 'delivered'
  when direction = 'outbound' and delivered = false then 'pending'
  else 'delivered'
end
where delivery_status = 'pending';

alter table public.messages
  drop constraint if exists messages_delivery_status_check;
alter table public.messages
  add constraint messages_delivery_status_check
  check (delivery_status in ('draft', 'pending', 'delivered', 'failed'));

create index if not exists messages_delivery_status_idx
  on public.messages (org_id, delivery_status, created_at desc);
