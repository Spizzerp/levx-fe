-- 0007_comment_rate_limit_rls.sql: lock down public.comment_rate_limit.
--
-- 0001_init.sql created `comment_rate_limit` but missed enabling RLS on
-- it. Supabase's database linter flagged this as critical:
--
--   "Table public.comment_rate_limit is public, but RLS has not been
--    enabled."
--
-- The trigger that writes the row (`enforce_comment_rate_limit`) is
-- SECURITY DEFINER, so it bypasses RLS regardless. Service-role queries
-- also bypass RLS. With RLS enabled and no policies, anon and
-- authenticated clients lose direct PostgREST access — which is what
-- the table's role demands (it's a server-side rate-limit ledger).
--
-- No data migration needed; this is purely a permissions tightening.

alter table public.comment_rate_limit enable row level security;

-- Intentionally no policies: clients should never read or write this
-- table directly. The trigger and any future edge-function callers
-- bypass RLS via SECURITY DEFINER / service_role.

comment on table public.comment_rate_limit is
  'Per-wallet comment rate-limit ledger. Edge / trigger writes only — RLS denies all client access.';
