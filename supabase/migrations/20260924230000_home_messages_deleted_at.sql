alter table public.home_messages
  add column if not exists deleted_at timestamptz;

create index if not exists home_messages_profile_active_idx
  on public.home_messages (profile_id, created_at desc)
  where deleted_at is null;
