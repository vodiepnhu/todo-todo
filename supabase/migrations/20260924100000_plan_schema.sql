-- Add to Plan V1 slice 1: plan_status, best_time, place categories/tags, plan child tables

do $$ begin
  create type public.plan_status as enum (
    'PLANNING', 'VISITED', 'SKIPPED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.best_time as enum (
    'morning', 'afternoon', 'sunset', 'evening', 'anytime'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_note_type as enum (
    'general', 'tip', 'warning', 'personal', 'booking', 'accessibility', 'weather'
  );
exception when duplicate_object then null;
end $$;

alter table public.items
  add column if not exists plan_status public.plan_status,
  add column if not exists best_time public.best_time;

alter table public.places
  add column if not exists categories text[] not null default '{}',
  add column if not exists tags text[] not null default '{}';

create table if not exists public.plan_travel (
  item_id uuid primary key references public.items(id) on delete cascade,
  from_text text,
  to_text text,
  transport_mode text,
  estimated_duration_min int,
  departure_time text,
  arrival_time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_costs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  category text not null,
  estimated_amount numeric not null default 0,
  actual_amount numeric,
  currency text not null default 'AUD',
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_activities (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_preparations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_todos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  task text not null,
  status text not null default 'pending',
  priority text,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  note_type public.plan_note_type not null default 'general',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists plan_costs_item_idx on public.plan_costs(item_id);
create index if not exists plan_activities_item_idx on public.plan_activities(item_id);
create index if not exists plan_preparations_item_idx on public.plan_preparations(item_id);
create index if not exists plan_todos_item_idx on public.plan_todos(item_id);
create index if not exists plan_notes_item_idx on public.plan_notes(item_id);
create index if not exists items_plan_status_idx on public.items(workspace_id, plan_status)
  where deleted_at is null and plan_status is not null;

alter table public.plan_travel enable row level security;
alter table public.plan_costs enable row level security;
alter table public.plan_activities enable row level security;
alter table public.plan_preparations enable row level security;
alter table public.plan_todos enable row level security;
alter table public.plan_notes enable row level security;

create or replace function public.is_item_workspace_member(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workspace_member(i.workspace_id)
  from public.items i
  where i.id = p_item_id
$$;

drop policy if exists plan_travel_all on public.plan_travel;
create policy plan_travel_all on public.plan_travel for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

drop policy if exists plan_costs_all on public.plan_costs;
create policy plan_costs_all on public.plan_costs for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

drop policy if exists plan_activities_all on public.plan_activities;
create policy plan_activities_all on public.plan_activities for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

drop policy if exists plan_preparations_all on public.plan_preparations;
create policy plan_preparations_all on public.plan_preparations for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

drop policy if exists plan_todos_all on public.plan_todos;
create policy plan_todos_all on public.plan_todos for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

drop policy if exists plan_notes_all on public.plan_notes;
create policy plan_notes_all on public.plan_notes for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

grant all on table public.plan_travel to anon, authenticated, service_role;
grant all on table public.plan_costs to anon, authenticated, service_role;
grant all on table public.plan_activities to anon, authenticated, service_role;
grant all on table public.plan_preparations to anon, authenticated, service_role;
grant all on table public.plan_todos to anon, authenticated, service_role;
grant all on table public.plan_notes to anon, authenticated, service_role;
