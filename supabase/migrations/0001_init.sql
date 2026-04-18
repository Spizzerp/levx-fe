-- 0001_init.sql: comments + auth_nonces + rate limiting + Realtime Authorization
create extension if not exists "pgcrypto";

-- ── auth_nonces ─────────────────────────────────────────────
create table public.auth_nonces (
  nonce       text        primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index auth_nonces_expires_at_idx on public.auth_nonces (expires_at);

alter table public.auth_nonces enable row level security;
-- No policies → all client access denied. Only service_role (Edge Function) reaches it.

-- ── comments ────────────────────────────────────────────────
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  market_id   text        not null,
  wallet      text        not null,
  body        text        not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index comments_market_id_created_at_idx
  on public.comments (market_id, created_at desc);
create index comments_wallet_idx
  on public.comments (wallet);

alter table public.comments enable row level security;

create policy "comments select public"
  on public.comments for select
  to anon, authenticated
  using (true);

create policy "comments insert own wallet"
  on public.comments for insert
  to authenticated
  with check ( (auth.jwt() ->> 'wallet') = wallet );

create policy "comments update own"
  on public.comments for update
  to authenticated
  using      ( (auth.jwt() ->> 'wallet') = wallet )
  with check ( (auth.jwt() ->> 'wallet') = wallet );

create policy "comments delete own"
  on public.comments for delete
  to authenticated
  using ( (auth.jwt() ->> 'wallet') = wallet );

-- ── comment_rate_limit ──────────────────────────────────────
create table public.comment_rate_limit (
  wallet           text        primary key,
  last_comment_at  timestamptz not null
);

-- ── rate limit trigger ──────────────────────────────────────
create or replace function public.enforce_comment_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  per_message_cooldown interval := interval '10 seconds';
  hourly_cap           int      := 30;
  last_at              timestamptz;
  hourly_count         int;
begin
  -- service_role bypasses all per-wallet checks (used by tests/admin scripts).
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (auth.jwt() ->> 'wallet') is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select last_comment_at into last_at
  from public.comment_rate_limit
  where wallet = new.wallet;

  if last_at is not null and (now() - last_at) < per_message_cooldown then
    raise exception 'rate_limit_cooldown'
      using errcode = 'P0001',
            hint = 'Wait a few seconds before posting again.';
  end if;

  select count(*) into hourly_count
  from public.comments
  where wallet = new.wallet
    and created_at > now() - interval '1 hour';

  if hourly_count >= hourly_cap then
    raise exception 'rate_limit_hourly'
      using errcode = 'P0001',
            hint = 'Hourly comment limit reached.';
  end if;

  insert into public.comment_rate_limit (wallet, last_comment_at)
  values (new.wallet, now())
  on conflict (wallet) do update set last_comment_at = excluded.last_comment_at;

  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

-- ── immutable-column trigger (edits only mutate body; edited_at server-stamped) ──
create or replace function public.lock_comment_immutables()
returns trigger language plpgsql as $$
begin
  if new.id         is distinct from old.id
  or new.market_id  is distinct from old.market_id
  or new.wallet     is distinct from old.wallet
  or new.created_at is distinct from old.created_at then
    raise exception 'immutable_column_modified' using errcode = '42501';
  end if;
  new.edited_at := now();
  return new;
end;
$$;

create trigger comments_lock_immutables
  before update on public.comments
  for each row execute function public.lock_comment_immutables();

-- ── Realtime Authorization for path-draw broadcast ──────────
create policy "path-draw subscribe authenticated"
  on realtime.messages for select
  to authenticated
  using ( (select realtime.topic()) like 'path-draw:%' );

create policy "path-draw publish authenticated"
  on realtime.messages for insert
  to authenticated
  with check ( (select realtime.topic()) like 'path-draw:%' );
