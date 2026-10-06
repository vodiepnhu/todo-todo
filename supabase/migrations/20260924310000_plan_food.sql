-- Food-to-try checklist for plans (parity with plan_activities)

create table if not exists public.plan_food (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_food_item_idx on public.plan_food(item_id);

alter table public.plan_food enable row level security;

drop policy if exists plan_food_all on public.plan_food;
create policy plan_food_all on public.plan_food for all
  using (public.is_item_workspace_member(item_id))
  with check (public.is_item_workspace_member(item_id));

grant all on table public.plan_food to anon, authenticated, service_role;
