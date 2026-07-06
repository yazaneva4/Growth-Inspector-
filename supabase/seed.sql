-- Demo workspace scaffold used by the public dashboards (org slug = 'demo').
-- Idempotent: safe to re-run. Intentionally seeds NO fake customers/
-- conversations — the demo inbox starts empty and only ever shows real
-- entries (from "Test the AI" → Save to workspace, or real webhook traffic).
with org as (
  insert into organizations (name, slug, plan, reply_mode, brand_voice)
  values ('Demo Oud Co', 'demo', 'business', 'autonomous',
    '{"tone":"Warm Saudi brand, light Khaleeji dialect","facts":"Premium oud & perfumes. Delivery 2-4 days across KSA. Returns within 7 days."}'::jsonb)
  on conflict (slug) do update set name = excluded.name
  returning id
),
acct as (
  insert into connected_accounts (org_id, platform, external_id, display_name)
  select id, 'sandbox', 'demo-sandbox', 'Demo Instagram' from org
  on conflict (platform, external_id) do update set display_name = excluded.display_name
  returning id, org_id
)
insert into connected_accounts (org_id, platform, external_id, display_name)
select org_id, 'email', 'support-inbox', 'Support Email' from acct
on conflict (platform, external_id) do update set display_name = excluded.display_name;
