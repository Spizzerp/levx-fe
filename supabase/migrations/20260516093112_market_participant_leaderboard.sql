-- market_participants: service-maintained per-wallet market leaderboard.
--
-- One row represents one distinct wallet in one market. The keeper (or another
-- service-role process) owns writes after aggregating Position accounts
-- off-chain; the frontend only reads this table through PostgREST. This avoids
-- per-visit browser `getProgramAccounts` scans while preserving enough data to
-- render top participants and an accurate distinct-wallet overflow count.

create table public.market_participants (
  market_id    bigint      not null,
  wallet       text        not null,
  collateral   numeric     not null default 0,
  exposure     numeric     not null default 0,
  pnl          numeric     not null default 0,
  positions    integer     not null default 0,
  updated_at   timestamptz not null default now(),

  primary key (market_id, wallet),
  constraint market_participants_wallet_nonempty check (length(btrim(wallet)) > 0),
  constraint market_participants_collateral_nonnegative check (collateral >= 0),
  constraint market_participants_exposure_nonnegative check (exposure >= 0),
  constraint market_participants_positions_nonnegative check (positions >= 0)
);

create index market_participants_sort_idx
  on public.market_participants (market_id, exposure desc, collateral desc, wallet);

alter table public.market_participants enable row level security;

create policy "market_participants select public"
  on public.market_participants for select
  to anon, authenticated
  using (true);

-- Supabase no longer guarantees that newly created tables are exposed to
-- PostgREST roles automatically, so grant the intended Data API surface
-- explicitly. No client write grants are issued; service_role bypasses RLS for
-- the keeper/updater process.
grant select on public.market_participants to anon, authenticated;
grant all on public.market_participants to service_role;

comment on table public.market_participants is
  'Service-maintained distinct wallet leaderboard per market. Public read; service-role writes only.';
