-- Shared Planner schema + RLS
-- Apply with: supabase db reset / supabase migration up

-- Supabase hosts pgcrypto in schema `extensions` (not public search_path)
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- Enums
do $$ begin
  create type workspace_type as enum ('PERSONAL', 'SHARED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('OWNER', 'ADMIN', 'MEMBER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_type as enum ('TODO', 'TOGO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_subtype as enum ('TASK', 'TRY', 'VISIT', 'TASK_AT_PLACE', 'TRY_AT_PLACE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_status as enum ('ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type repeat_mode as enum ('ONE_OFF', 'REPEATABLE', 'RECURRING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type time_precision as enum ('EXACT', 'DATE_ONLY', 'APPROXIMATE', 'UNKNOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('COMPLETED', 'VISITED', 'TRIED', 'STARTED', 'SKIPPED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_role as enum ('PRIMARY', 'ALTERNATIVE', 'ORIGIN', 'DESTINATION');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_type as enum ('USER', 'AI', 'SYSTEM', 'ACTION');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pending_state as enum ('AWAITING_CONFIRM_1', 'AWAITING_CONFIRM_2', 'EXECUTED', 'CANCELLED', 'EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type action_type as enum ('CREATE', 'UPDATE', 'DELETE', 'LOG_EVENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_category as enum (
    'WORK_STUDY','ADMIN','ERRAND','SHOPPING','FOOD','HEALTH_FITNESS','SOCIAL',
    'TRAVEL','NATURE','ENTERTAINMENT','HOBBY','SERVICE','PERSONAL','OTHER'
  );
exception when duplicate_object then null; end $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'Australia/Sydney',
  default_travel_mode text not null default 'driving',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_type workspace_type not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (workspace_id, profile_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_by uuid not null references public.profiles(id),
  email text,
  role member_role not null default 'MEMBER',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Items & places
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_type item_type not null,
  subtype item_subtype not null,
  title text not null,
  description text,
  category item_category,
  category_label text,
  priority int,
  status item_status not null default 'ACTIVE',
  repeat_mode repeat_mode not null default 'ONE_OFF',
  due_at timestamptz,
  planned_start_at timestamptz,
  time_precision time_precision not null default 'UNKNOWN',
  estimated_duration_min int,
  duration_source text,
  created_by uuid not null references public.profiles(id),
  last_updated_by uuid references public.profiles(id),
  version int not null default 1,
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  formatted_address text,
  google_place_id text,
  latitude double precision,
  longitude double precision,
  original_maps_url text,
  google_maps_url text,
  primary_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_places (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  role place_role not null default 'PRIMARY',
  created_at timestamptz not null default now(),
  unique (item_id, place_id, role)
);

create table if not exists public.item_assignees (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  anyone boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.item_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  event_type event_type not null,
  occurred_at timestamptz not null,
  ended_at timestamptz,
  time_precision time_precision not null default 'UNKNOWN',
  actual_duration_min int,
  place_id uuid references public.places(id),
  note text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id),
  message_type message_type not null default 'USER',
  content text not null,
  reply_to_message_id uuid references public.workspace_messages(id),
  linked_entity_type text,
  linked_entity_id uuid,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_type action_type not null,
  payload_json jsonb not null default '{}'::jsonb,
  before_json jsonb,
  after_json jsonb,
  base_entity_version int,
  initiated_by uuid not null references public.profiles(id),
  state pending_state not null default 'AWAITING_CONFIRM_1',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  executed_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Helper: membership check
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.profile_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.profile_id = auth.uid()
      and m.role in ('OWNER', 'ADMIN')
  );
$$;

-- Auto profile + personal workspace on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display text;
begin
  display := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  insert into public.profiles (id, display_name)
  values (new.id, display)
  on conflict (id) do nothing;

  insert into public.workspaces (name, workspace_type, created_by)
  values (display || '''s Space', 'PERSONAL', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (ws_id, new.id, 'OWNER');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.items enable row level security;
alter table public.places enable row level security;
alter table public.item_places enable row level security;
alter table public.item_assignees enable row level security;
alter table public.item_events enable row level security;
alter table public.workspace_messages enable row level security;
alter table public.pending_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.profile_id = auth.uid() and them.profile_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- Workspaces
create policy workspaces_select on public.workspaces for select using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert with check (created_by = auth.uid());
create policy workspaces_update on public.workspaces for update using (public.is_workspace_admin(id));

-- Members
create policy members_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert with check (
  public.is_workspace_admin(workspace_id) or profile_id = auth.uid()
);
create policy members_update on public.workspace_members for update using (public.is_workspace_admin(workspace_id));
create policy members_delete on public.workspace_members for delete using (
  public.is_workspace_admin(workspace_id) or profile_id = auth.uid()
);

-- Invites
create policy invites_select on public.workspace_invites for select using (
  public.is_workspace_member(workspace_id) or true
);
create policy invites_insert on public.workspace_invites for insert with check (public.is_workspace_admin(workspace_id));
create policy invites_update on public.workspace_invites for update using (true);

-- Generic workspace-scoped tables
create policy items_all on public.items for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy places_all on public.places for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy events_all on public.item_events for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy messages_all on public.workspace_messages for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy pending_all on public.pending_actions for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy audit_select on public.audit_logs for select using (public.is_workspace_member(workspace_id));
create policy audit_insert on public.audit_logs for insert with check (public.is_workspace_member(workspace_id));
create policy notifications_all on public.notifications for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy item_places_all on public.item_places for all using (
  exists (select 1 from public.items i where i.id = item_id and public.is_workspace_member(i.workspace_id))
) with check (
  exists (select 1 from public.items i where i.id = item_id and public.is_workspace_member(i.workspace_id))
);

create policy item_assignees_all on public.item_assignees for all using (
  exists (select 1 from public.items i where i.id = item_id and public.is_workspace_member(i.workspace_id))
) with check (
  exists (select 1 from public.items i where i.id = item_id and public.is_workspace_member(i.workspace_id))
);

-- Realtime (ignore errors if already added)
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.item_events;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.workspace_messages;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.audit_logs;
exception when others then null;
end $$;

create index if not exists items_workspace_idx on public.items(workspace_id) where deleted_at is null;
create index if not exists events_workspace_idx on public.item_events(workspace_id, occurred_at desc);
create index if not exists messages_workspace_idx on public.workspace_messages(workspace_id, created_at);
