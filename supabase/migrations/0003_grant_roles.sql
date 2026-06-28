-- Table-level grants for the Supabase API roles. RLS still gates which rows
-- each role can actually see (anon → demo workspace only; authenticated →
-- their own org via membership).
grant usage on schema public to anon, authenticated;

-- Anonymous: read-only.
grant select on organizations, conversations, messages, escalations, connected_accounts to anon;

-- Authenticated tenants: full access, restricted to their org by RLS.
grant select, insert, update, delete on
  organizations, memberships, connected_accounts, conversations, messages, escalations
  to authenticated;

-- Helper functions used inside RLS policies. NOTE: the linter warns these are
-- callable via /rest/v1/rpc, but they are benign — is_demo_org returns only a
-- boolean, and auth_org_ids returns only the caller's own org IDs (nothing for
-- anonymous callers). EXECUTE is required for the policies to evaluate.
grant execute on function auth_org_ids() to anon, authenticated;
grant execute on function is_demo_org(uuid) to anon, authenticated;
