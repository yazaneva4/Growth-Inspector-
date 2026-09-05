alter table public.conversations add column if not exists customer_email text;
alter table public.conversations add column if not exists email_subject text;
alter table public.conversations add column if not exists thread_key text;
alter table public.messages add column if not exists external_message_id text;
alter table public.messages add column if not exists email_subject text;
alter table public.messages add column if not exists in_reply_to text;

create unique index if not exists messages_external_message_id_key
  on public.messages(external_message_id)
  where external_message_id is not null;
create index if not exists conversations_org_customer_email_idx
  on public.conversations(org_id, customer_email);
create index if not exists conversations_thread_key_idx
  on public.conversations(thread_key)
  where thread_key is not null;

alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.conversations';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.messages';
  exception when duplicate_object then null;
  end;
end $$;
