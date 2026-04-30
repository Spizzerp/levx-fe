-- 0006_keeper_heartbeat.sql: single-row liveness signal for the keeper.
--
-- The keeper's HTTP /health endpoint isn't reachable cross-origin from the
-- FE without CORS configuration on the keeper host. Easier path: the
-- keeper writes `now()` to this row once per poll cycle (via the same
-- service-role key it already uses for other Supabase ops), and the FE
-- reads through PostgREST (anon key) every 60s. Stale-by-N-seconds →
-- amber/red dot in the footer.
--
-- Single-row by design — the CHECK gate ensures a misbehaving caller
-- can't spawn additional rows. The unique-row pattern keeps the read
-- path trivial (`select * from keeper_heartbeat limit 1`).

create table public.keeper_heartbeat (
  id          smallint    primary key check (id = 1),
  updated_at  timestamptz not null default now()
);

-- Seed the singleton row at epoch so the FE's first read always
-- succeeds AND the keeper-health dot shows "offline" until the keeper
-- actually writes a heartbeat. Seeding with `now()` would briefly show
-- "online" on a fresh deploy before the keeper-side writer lands —
-- false-positive worse than starting red.
insert into public.keeper_heartbeat (id, updated_at)
  values (1, to_timestamp(0))
  on conflict (id) do nothing;

alter table public.keeper_heartbeat enable row level security;

-- Public read so the FE can poll without authentication. The exposed
-- shape is just a timestamp — no PII.
create policy "keeper_heartbeat read public"
  on public.keeper_heartbeat for select
  to anon, authenticated
  using (true);

-- Writes are service-role only. The keeper is the only client that
-- should ever touch this — the program/UI explicitly don't.

comment on table public.keeper_heartbeat is
  'Single-row liveness signal. Keeper updates updated_at once per poll; FE reads + alerts when stale.';
