-- Stream changes to the dashboards. Realtime still enforces RLS, so each
-- subscriber only receives rows they're allowed to read.
alter table conversations replica identity full;
alter table messages replica identity full;
alter table escalations replica identity full;

do $$
begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table escalations;
exception when duplicate_object then null; end $$;
