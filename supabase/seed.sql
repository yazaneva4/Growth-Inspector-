-- Demo workspace used by the public dashboards (org slug = 'demo').
-- Idempotent: safe to re-run.
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
),
email_acct as (
  insert into connected_accounts (org_id, platform, external_id, display_name)
  select id, 'email', 'support-inbox', 'Support Email' from org
  on conflict (platform, external_id) do update set display_name = excluded.display_name
  returning id
)
insert into conversations (org_id, account_id, platform, customer_handle, customer_name, status, intent, sentiment, language, lead_score, last_message_at, created_at)
select acct.org_id, acct.id, 'sandbox', c.handle, c.name, c.status::conversation_status,
       c.intent, c.sentiment, c.language, c.lead, now() - (c.ago || ' hours')::interval, now() - (c.ago || ' hours')::interval
from acct, (values
  ('user_fahad','فهد','open','price_inquiry','neutral','ar-dialect',70, 2),
  ('user_sara','سارة','open','hot_lead','positive','ar-dialect',92, 5),
  ('user_noura','نورة','escalated','complaint','negative','ar-dialect',30, 9),
  ('user_majed','ماجد','open','support','neutral','arabizi',45, 20),
  ('user_lina','Lina','open','price_inquiry','positive','en',65, 28),
  ('user_omar','عمر','closed','hot_lead','positive','mixed',88, 40),
  ('user_spam','promo','open','spam','neutral','en',5, 50),
  ('user_huda','هدى','escalated','complaint','negative','ar-dialect',25, 60),
  ('user_khalid','خالد','open','price_inquiry','neutral','ar-dialect',60, 72),
  ('user_reem','ريم','open','hot_lead','positive','ar-dialect',95, 80)
) as c(handle,name,status,intent,sentiment,language,lead,ago)
on conflict do nothing;
