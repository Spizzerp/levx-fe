-- Renamed from 0002_waitlist_entries.sql → 0008 to resolve a version
-- collision with 0002_users.sql. Both files were authored at version
-- 0002 in the early dev period; the Supabase CLI's `_supabase_migrations`
-- history table treats version as a unique key, so only one of the
-- two could be marked applied. Bumping waitlist_entries to 0008 makes
-- both files distinguishable in history without changing schema. The
-- table's content already exists on remote (applied during the
-- pre-history-tracking period), so this rename is paired with
-- `migration repair --status applied 0008` rather than re-running
-- the CREATE TABLE.

create table public.waitlist_entries (
  id                 uuid        primary key default gen_random_uuid(),
  email              text        not null,
  email_normalized   text        not null,
  x_username         text        not null,
  wallet_address     text        not null,
  source             text        not null default 'landing_page',
  status             text        not null default 'pending'
                                   check (status in ('pending', 'invited', 'joined', 'rejected')),
  submitted_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  joined_at          timestamptz,
  linked_user_wallet text,
  metadata           jsonb       not null default '{}'::jsonb
);

create unique index waitlist_entries_email_normalized_uq
  on public.waitlist_entries (email_normalized);

create unique index waitlist_entries_wallet_address_uq
  on public.waitlist_entries (wallet_address);

create index waitlist_entries_status_submitted_at_idx
  on public.waitlist_entries (status, submitted_at desc);

alter table public.waitlist_entries enable row level security;
-- No policies → client access denied. Public submissions go through Edge Function only.

create or replace function public.touch_waitlist_entries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger waitlist_entries_touch_updated_at
  before update on public.waitlist_entries
  for each row execute function public.touch_waitlist_entries_updated_at();
