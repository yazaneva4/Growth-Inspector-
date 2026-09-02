-- Complete the Realtime publication for tables introduced after the
-- original realtime migrations. RLS remains the authorization boundary.

alter table public.competitors replica identity full;
alter table public.backup_contacts replica identity full;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.competitors';
  exception when duplicate_object then null;
  end;

  begin
    execute 'alter publication supabase_realtime add table public.backup_contacts';
  exception when duplicate_object then null;
  end;
end $$;
