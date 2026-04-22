-- 0002_users.sql: app users + avatar storage

create table public.users (
  user_id           uuid        primary key default gen_random_uuid(),
  wallet_address    text        not null unique,
  wallet_name       text        not null,
  username          text        not null unique,
  display_name      text        not null,
  bio               text        not null default '',
  x_id              text        not null default '',
  avatar_kind       text        not null default 'sigil',
  avatar_sigil_idx  integer     not null default 0,
  avatar_image_path text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint users_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9_.]{3,20}$'
  ),
  constraint users_display_name_length check (
    length(btrim(display_name)) between 2 and 32
  ),
  constraint users_bio_length check (length(bio) <= 160),
  constraint users_x_id_length check (length(x_id) <= 32),
  constraint users_x_id_no_at check (x_id !~ '^@'),
  constraint users_avatar_kind check (avatar_kind in ('sigil', 'image')),
  constraint users_avatar_sigil_idx check (avatar_sigil_idx between 0 and 7),
  constraint users_avatar_shape check (
    (avatar_kind = 'sigil' and avatar_image_path is null)
    or
    (avatar_kind = 'image' and avatar_image_path is not null)
  )
);

create index users_wallet_name_idx on public.users (wallet_name);

alter table public.users enable row level security;

create policy "users select public"
  on public.users for select
  to anon, authenticated
  using (true);

create policy "users insert own wallet"
  on public.users for insert
  to authenticated
  with check ((auth.jwt() ->> 'wallet') = wallet_address);

create policy "users update own wallet"
  on public.users for update
  to authenticated
  using ((auth.jwt() ->> 'wallet') = wallet_address)
  with check ((auth.jwt() ->> 'wallet') = wallet_address);

create policy "users delete own wallet"
  on public.users for delete
  to authenticated
  using ((auth.jwt() ->> 'wallet') = wallet_address);

create or replace function public.touch_user_updated_at()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id
  or new.wallet_address is distinct from old.wallet_address
  or new.created_at is distinct from old.created_at then
    raise exception 'immutable_user_column_modified' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_user_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "profile images select public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-images');

create policy "profile images insert own wallet folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet')
  );

create policy "profile images update own wallet folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet')
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet')
  );

create policy "profile images delete own wallet folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'wallet')
  );
