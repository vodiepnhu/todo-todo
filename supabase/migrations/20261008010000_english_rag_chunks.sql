-- Keep display text unchanged while indexing and embedding English copies.
alter table public.item_embeddings
  add column if not exists chunk_text_en text,
  add column if not exists source_language text not null default 'en',
  add column if not exists translation_version text not null default 'v1';

update public.item_embeddings
set chunk_text_en = coalesce(chunk_text_en, chunk_text),
    source_language = 'other',
    translation_version = 'legacy'
where chunk_text_en is null;

alter table public.item_embeddings
  alter column chunk_text_en set not null;

drop index if exists public.item_embeddings_fts_idx;
alter table public.item_embeddings drop column if exists search_tsv;
alter table public.item_embeddings
  add column search_tsv tsvector
  generated always as (to_tsvector('english', coalesce(chunk_text_en, ''))) stored;

create index if not exists item_embeddings_fts_idx
  on public.item_embeddings using gin (search_tsv);

-- Backward-compatible writer for callers that do not pass translated fields.
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
    workspace_id, source_type, source_id, chunk_text, chunk_text_en,
    source_language, translation_version, embedding, metadata, updated_at
  ) values (
    p_workspace_id, p_source_type, p_source_id, p_chunk_text, p_chunk_text,
    'en', 'v1', p_embedding::extensions.vector,
    coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (source_type, source_id) do update set
    workspace_id = excluded.workspace_id,
    chunk_text = excluded.chunk_text,
    chunk_text_en = excluded.chunk_text_en,
    source_language = excluded.source_language,
    translation_version = excluded.translation_version,
    embedding = excluded.embedding,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

create or replace function public.upsert_item_embedding(
  p_workspace_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_chunk_text text,
  p_chunk_text_en text,
  p_source_language text,
  p_translation_version text,
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
    workspace_id, source_type, source_id, chunk_text, chunk_text_en,
    source_language, translation_version, embedding, metadata, updated_at
  ) values (
    p_workspace_id, p_source_type, p_source_id, p_chunk_text,
    coalesce(nullif(p_chunk_text_en, ''), p_chunk_text),
    coalesce(nullif(p_source_language, ''), 'other'),
    coalesce(nullif(p_translation_version, ''), 'v1'),
    p_embedding::extensions.vector, coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (source_type, source_id) do update set
    workspace_id = excluded.workspace_id,
    chunk_text = excluded.chunk_text,
    chunk_text_en = excluded.chunk_text_en,
    source_language = excluded.source_language,
    translation_version = excluded.translation_version,
    embedding = excluded.embedding,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_item_embedding(uuid, text, uuid, text, text, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.upsert_item_embedding(uuid, text, uuid, text, text, text, text, text, jsonb)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
