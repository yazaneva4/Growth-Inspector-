-- Keep the dashboard's wildcard Realtime subscription genuinely live for every
-- application table that is protected by RLS. Tables without RLS are skipped so
-- this migration cannot accidentally stream public-only data to authenticated
-- browser clients.
do $$
declare
  t record;
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and c.relname not like 'pg_%'
    order by c.relname
  loop
    execute format('alter table public.%I replica identity full', t.table_name);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t.table_name);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
