alter table public.waitlist_entries
  add column linked_user_id uuid references public.users (user_id) on delete set null;

create index waitlist_entries_linked_user_id_idx
  on public.waitlist_entries (linked_user_id);
