-- Realtime consistency fix: `competitors` was left at REPLICA IDENTITY DEFAULT
-- (primary key only), while every other live table is FULL. Realtime filters
-- UPDATE/DELETE events through RLS against the OLD row, which needs the full
-- record — without it, competitor edits/deletes never reach subscribed clients.
-- Bring it in line so all realtime tables behave identically.
alter table public.competitors replica identity full;
