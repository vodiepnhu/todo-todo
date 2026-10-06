-- Hybrid RAG: keyword FTS on item_embeddings.chunk_text + optional metadata filters

alter table public.item_embeddings
  add column if not exists search_tsv tsvector
  generated always as (to_tsvector('english', coalesce(chunk_text, ''))) stored;

create index if not exists item_embeddings_fts_idx
  on public.item_embeddings using gin (search_tsv);

-- Keyword / BM25-ish rank (ts_rank)
create or replace function public.keyword_match_item_embeddings(
  p_workspace_ids uuid[],
  p_query_text text,
  p_match_count int default 20,
  p_item_type text default null,
  p_tag text default null
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
    ts_rank_cd(e.search_tsv, websearch_to_tsquery('english', p_query_text))::float8 as score,
    e.metadata,
    e.workspace_id,
    w.name as project_name
  from public.item_embeddings e
  join public.workspaces w on w.id = e.workspace_id
  where e.workspace_id = any (p_workspace_ids)
    and e.source_type = 'item'
    and e.search_tsv @@ websearch_to_tsquery('english', p_query_text)
    and (
      p_item_type is null
      or coalesce(e.metadata->>'item_type', '') = p_item_type
    )
    and (
      p_tag is null
      or e.metadata->'tags' ? p_tag
      or coalesce(e.metadata->>'project_name', '') ilike '%' || p_tag || '%'
    )
  order by score desc
  limit greatest(p_match_count, 1);
$$;

-- Semantic match with optional metadata filters
create or replace function public.match_item_embeddings(
  p_workspace_ids uuid[],
  p_query text,
  p_match_count int default 20,
  p_item_type text default null,
  p_tag text default null
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
    and (
      p_item_type is null
      or coalesce(e.metadata->>'item_type', '') = p_item_type
    )
    and (
      p_tag is null
      or e.metadata->'tags' ? p_tag
      or coalesce(e.metadata->>'project_name', '') ilike '%' || p_tag || '%'
    )
  order by e.embedding <=> p_query::extensions.vector
  limit greatest(p_match_count, 1);
$$;

-- Keep 3-arg semantic overload for older callers
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
  select * from public.match_item_embeddings(
    p_workspace_ids, p_query, p_match_count, null::text, null::text
  );
$$;

-- Single-ws back-compat
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
  select m.source_id, m.chunk_text, m.score, m.metadata
  from public.match_item_embeddings(
    array[p_workspace_id], p_query, p_match_count, null::text, null::text
  ) m;
$$;

grant execute on function public.keyword_match_item_embeddings(uuid[], text, int, text, text)
  to anon, authenticated, service_role;
grant execute on function public.match_item_embeddings(uuid[], text, int, text, text)
  to anon, authenticated, service_role;
grant execute on function public.match_item_embeddings(uuid[], text, int)
  to anon, authenticated, service_role;
grant execute on function public.match_item_embeddings(uuid, text, int)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
