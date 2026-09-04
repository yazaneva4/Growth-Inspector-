-- Growth Inspector owns the delivery of its email verification codes.
-- Supabase Auth remains the identity/session backend; this table only stores
-- short-lived, hashed verification challenges for the application email flow.
create table if not exists public.auth_email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.auth_email_codes
  add column if not exists user_id uuid;

create index if not exists auth_email_codes_email_created_idx
  on public.auth_email_codes (email, created_at desc);

alter table public.auth_email_codes enable row level security;

-- No browser role should read or write verification codes. Server routes use
-- the Supabase service-role client for this table.
revoke all on table public.auth_email_codes from anon, authenticated;

-- Keep the table small without exposing it to clients.
create or replace function public.cleanup_auth_email_codes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_email_codes
  where expires_at < now() - interval '1 day';
$$;
revoke all on function public.cleanup_auth_email_codes() from public, anon, authenticated;
