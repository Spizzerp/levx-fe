-- 0005_faucet_requests.sql: rate-limit table + atomic reserve function for
-- the test-USDC faucet edge function.
--
-- One row per requesting wallet. Edge function calls
-- `try_reserve_faucet_slot()` which serializes concurrent requests via a
-- `SELECT … FOR UPDATE` row lock — without that, two requests landing in
-- the same RDS millisecond can both pass the cooldown check at the
-- default READ COMMITTED isolation level and both succeed in minting.
--
-- RLS denies all client access. Both the table and the function are
-- service-role only (Edge Function).

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

-- ── Atomic reserve ──────────────────────────────────────────────────
-- Returns one row:
--   allowed              true  → caller may mint
--                        false → caller is rate-limited
--   retry_after          seconds until the wallet is allowed again (only
--                        meaningful when allowed = false)
--   prior_last_minted_at timestamp the row had BEFORE this reservation
--                        (or NULL if no prior row). Caller threads this
--                        back into the rollback function on mint failure
--                        to avoid blocking the wallet for 24h on a
--                        transient on-chain error.
--
-- The `SELECT … FOR UPDATE` row lock is the load-bearing primitive:
-- it serializes concurrent calls for the same wallet so only one can
-- win the cooldown gate. The PK constraint covers the rare race where
-- the row doesn't yet exist and two callers both try to insert.

create or replace function public.try_reserve_faucet_slot(
  p_wallet text,
  p_cooldown_seconds integer
) returns table (
  allowed              boolean,
  retry_after          integer,
  prior_last_minted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing      public.faucet_requests%rowtype;
  v_now           timestamptz := now();
  v_cutoff        timestamptz := v_now - make_interval(secs => p_cooldown_seconds);
  v_elapsed_sec   integer;
begin
  -- Lock the row if it exists. Rows that don't exist yet aren't locked
  -- (no row to lock); the unique_violation handler below covers the
  -- concurrent-insert race.
  select *
    into v_existing
    from public.faucet_requests
    where wallet = p_wallet
    for update;

  if found then
    if v_existing.last_minted_at >= v_cutoff then
      v_elapsed_sec := extract(epoch from (v_now - v_existing.last_minted_at))::integer;
      return query select false,
                          greatest(p_cooldown_seconds - v_elapsed_sec, 0),
                          null::timestamptz;
      return;
    end if;
    update public.faucet_requests
       set last_minted_at = v_now,
           count          = v_existing.count + 1
       where wallet = p_wallet;
    return query select true, null::integer, v_existing.last_minted_at;
    return;
  end if;

  -- No existing row.
  begin
    insert into public.faucet_requests (wallet, last_minted_at, count)
    values (p_wallet, v_now, 1);
    return query select true, null::integer, null::timestamptz;
  exception when unique_violation then
    -- Another transaction inserted between our SELECT FOR UPDATE
    -- (which found nothing) and our INSERT. Treat as rate-limited; the
    -- next request will see the row and proceed normally.
    return query select false, p_cooldown_seconds, null::timestamptz;
  end;
end;
$$;

revoke all on function public.try_reserve_faucet_slot(text, integer)
  from public, anon, authenticated;
grant execute on function public.try_reserve_faucet_slot(text, integer)
  to service_role;

comment on function public.try_reserve_faucet_slot(text, integer) is
  'Atomic reserve for the test-USDC faucet. Serializes concurrent same-wallet calls via SELECT … FOR UPDATE so only one can win the cooldown gate.';
