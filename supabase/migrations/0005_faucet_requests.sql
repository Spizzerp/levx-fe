-- 0005_faucet_requests.sql: rate-limit table for the test-USDC faucet edge function.
--
-- One row per requesting wallet. Edge function upserts on each request and
-- gates by `last_minted_at` against a fixed cooldown. RLS denies all client
-- access — only the service-role key (Edge Function) reaches it.

create table public.faucet_requests (
  wallet         text        primary key,
  last_minted_at timestamptz not null default now(),
  count          integer     not null default 0
);
create index faucet_requests_last_minted_at_idx
  on public.faucet_requests (last_minted_at desc);

alter table public.faucet_requests enable row level security;
-- No policies → all client access denied. Service role only.

comment on table public.faucet_requests is
  'Rate-limit ledger for /functions/v1/request-test-usdc. Edge-only writes.';
