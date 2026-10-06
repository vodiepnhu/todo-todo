-- M23: project folders + metadata + home chat + CREATE_PROJECT + multi-ws RAG

create table if not exists public.project_folders (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces
  add column if not exists folder_id uuid references public.project_folders (id) on delete set null,
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists icon text,
  add column if not exists color text;

create index if not exists workspaces_folder_idx on public.workspaces (folder_id);

create table if not exists public.home_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  message_type message_type not null default 'USER',
  content text not null,
  linked_entity_type text,
  linked_entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists home_messages_profile_idx
  on public.home_messages (profile_id, created_at desc);

-- CREATE_PROJECT (PG 16 supports IF NOT EXISTS)
do $$ begin
  alter type action_type add value if not exists 'CREATE_PROJECT';
exception
  when duplicate_object then null;
end $$;

-- pending_actions: allow null workspace only for CREATE_PROJECT
alter table public.pending_actions
  alter column workspace_id drop not null;

alter table public.pending_actions
  drop constraint if exists pending_actions_workspace_for_action;

alter table public.pending_actions
  add constraint pending_actions_workspace_for_action
  check (
    (action_type::text = 'CREATE_PROJECT' and workspace_id is null)
    or (action_type::text <> 'CREATE_PROJECT' and workspace_id is not null)
  );

-- RLS folders
alter table public.project_folders enable row level security;
drop policy if exists project_folders_owner on public.project_folders;
create policy project_folders_owner on public.project_folders
  for all
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- RLS home_messages
alter table public.home_messages enable row level security;
drop policy if exists home_messages_self on public.home_messages;
create policy home_messages_self on public.home_messages
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- pending RLS: member OR (CREATE_PROJECT initiated by self with null ws)
-- Compare via ::text — same-tx ADD VALUE cannot be used as typed enum label (55P04)
drop policy if exists pending_all on public.pending_actions;
create policy pending_all on public.pending_actions for all
  using (
    (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (
      workspace_id is null
      and initiated_by = auth.uid()
      and action_type::text = 'CREATE_PROJECT'
    )
  )
  with check (
    (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (
      workspace_id is null
      and initiated_by = auth.uid()
      and action_type::text = 'CREATE_PROJECT'
    )
  );

-- Multi-ws match (primary)
create or replace function public.match_item_embeddings(
  p_workspace_ids uuid[],
  p_query text,
  p_match_count int default 20
)
returns table (
  source_id uuid,
  chunk_text text,
  score float8,
  metadata jsonb,
  workspace_id uuid,
  project_name text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.source_id,
    e.chunk_text,
    (1 - (e.embedding <=> p_query::extensions.vector))::float8 as score,
    e.metadata,
    e.workspace_id,
    w.name as project_name
  from public.item_embeddings e
  join public.workspaces w on w.id = e.workspace_id
  where e.workspace_id = any (p_workspace_ids)
    and e.source_type = 'item'
  order by e.embedding <=> p_query::extensions.vector
  limit greatest(p_match_count, 1);
$$;

-- Back-compat wrapper (single id)
create or replace function public.match_item_embeddings(
  p_workspace_id uuid,
  p_query text,
  p_match_count int default 20
)
returns table (
  source_id uuid,
  chunk_text text,
  score float8,
  metadata jsonb
)
language sql
stable
security invoker
as $$
  select m.source_id, m.chunk_text, m.score, m.metadata
  from public.match_item_embeddings(array[p_workspace_id], p_query, p_match_count) m;
$$;

grant execute on function public.match_item_embeddings(uuid[], text, int)
  to anon, authenticated, service_role;
grant execute on function public.match_item_embeddings(uuid, text, int)
  to anon, authenticated, service_role;

-- PostgREST + RLS roles (manual apply must match migrate.sh)
grant all on table public.project_folders to anon, authenticated, service_role;
grant all on table public.home_messages to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
