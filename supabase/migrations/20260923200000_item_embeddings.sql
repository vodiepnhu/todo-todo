-- M20: pgvector embeddings for workspace RAG (items)
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.item_embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_type text not null check (source_type in ('item', 'event', 'message_summary')),
  source_id uuid not null,
  chunk_text text not null,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists item_embeddings_workspace_idx
  on public.item_embeddings (workspace_id);

create index if not exists item_embeddings_hnsw_idx
  on public.item_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.item_embeddings enable row level security;

drop policy if exists item_embeddings_all on public.item_embeddings;
create policy item_embeddings_all on public.item_embeddings
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- PostgREST-friendly: pass embedding as '[1,2,...]' text
create or replace function public.upsert_item_embedding(
  p_workspace_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_chunk_text text,
  p_embedding text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into public.item_embeddings (
    workspace_id, source_type, source_id, chunk_text, embedding, metadata, updated_at
  ) values (
    p_workspace_id,
    p_source_type,
    p_source_id,
    p_chunk_text,
    p_embedding::extensions.vector,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (source_type, source_id) do update set
    workspace_id = excluded.workspace_id,
    chunk_text = excluded.chunk_text,
    embedding = excluded.embedding,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

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
set search_path = public, extensions
as $$
  select
    e.source_id,
    e.chunk_text,
    (1 - (e.embedding <=> p_query::extensions.vector))::float8 as score,
    e.metadata
  from public.item_embeddings e
  where e.workspace_id = p_workspace_id
    and e.source_type = 'item'
  order by e.embedding <=> p_query::extensions.vector
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.upsert_item_embedding(uuid, text, uuid, text, text, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.match_item_embeddings(uuid, text, int)
  to anon, authenticated, service_role;
