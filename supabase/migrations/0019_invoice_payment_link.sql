-- Real hosted payment link (Moyasar) attached to each invoice, so an
-- emailed invoice can include a working "Pay now" button instead of a
-- static, unpayable document.
alter table invoices
  add column payment_url text,
  add column moyasar_id text;
