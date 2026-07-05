-- Complete realtime coverage: every workspace table streams changes.
do $$
declare t text;
begin
  foreach t in array array['organizations','memberships','connected_accounts','team_invites','job_applications']
  loop
    execute format('alter table %I replica identity full', t);
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
