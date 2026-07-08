-- =============================================================================
-- 0011_embeddings_ollama.sql — migrate embeddings from Voyage(1024) to
--                              Ollama/embeddinggemma(768)
-- =============================================================================
-- Safe, data-preserving migration. Vectors from different models must NEVER be
-- mixed in one semantic index, so we clear the old 1024-dim Voyage vectors and
-- switch the columns to 768 dimensions. Everything else is preserved:
-- documents, versions, chunks (their text/heading/page/metadata), incidents,
-- incident knowledge, users, clients, machines. Only the raw `embedding` values
-- are dropped; regenerate them with `npm run embeddings:reindex`.
--
-- Keyword / full-text search (content_tsv) is untouched, so hybrid retrieval
-- keeps working while embeddings are absent.

-- --- document_chunks ---------------------------------------------------------
drop index if exists public.document_chunks_embedding_idx;

-- Add embedding provenance so vectors from different providers/models can be
-- told apart and never silently mixed in the future.
alter table public.document_chunks
  add column if not exists embedding_provider  text,
  add column if not exists embedding_model     text,
  add column if not exists embedding_dimension int,
  add column if not exists embedded_at         timestamptz;

-- Clear old (Voyage 1024) vectors and switch the column to 768 dimensions.
-- USING null wipes any existing values as part of the type change.
alter table public.document_chunks
  alter column embedding type vector(768) using null;

create index document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- --- incident_knowledge_chunks ----------------------------------------------
drop index if exists public.incident_knowledge_chunks_embedding_idx;

alter table public.incident_knowledge_chunks
  add column if not exists embedding_provider  text,
  add column if not exists embedding_model     text,
  add column if not exists embedding_dimension int,
  add column if not exists embedded_at         timestamptz;

alter table public.incident_knowledge_chunks
  alter column embedding type vector(768) using null;

create index incident_knowledge_chunks_embedding_idx
  on public.incident_knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- --- Recreate semantic search RPCs at vector(768) ----------------------------
-- The argument type changes (vector(1024) -> vector(768)) so the old functions
-- must be dropped, not `create or replace`d. A new optional filter restricts
-- results to a specific embedding model (defence in depth against mixing).
drop function if exists public.match_document_chunks(vector, int, uuid);
drop function if exists public.match_incident_chunks(vector, int, uuid, uuid);

create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_count int default 30,
  filter_machine_model_id uuid default null,
  filter_embedding_model text default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_code text,
  document_title text,
  document_status document_status,
  machine_model_id uuid,
  heading text,
  content text,
  page_number int,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    d.id,
    d.document_code,
    d.title,
    d.status,
    d.machine_model_id,
    dc.heading,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.document_versions dv on dv.id = dc.document_version_id
  join public.documents d on d.id = dv.document_id
  where dc.embedding is not null
    and d.status = 'approved'
    and (filter_machine_model_id is null or d.machine_model_id = filter_machine_model_id)
    and (filter_embedding_model is null or dc.embedding_model = filter_embedding_model)
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_incident_chunks(
  query_embedding vector(768),
  match_count int default 30,
  filter_machine_model_id uuid default null,
  exclude_incident_id uuid default null,
  filter_embedding_model text default null
)
returns table (
  chunk_id uuid,
  incident_id uuid,
  incident_number text,
  incident_status incident_status,
  machine_model_id uuid,
  knowledge_type incident_knowledge_type,
  content text,
  has_confirmed_cause boolean,
  similarity float
)
language sql
stable
as $$
  select
    ikc.id,
    i.id,
    i.incident_number,
    i.status,
    i.machine_model_id,
    ikc.knowledge_type,
    ikc.content,
    (i.confirmed_cause_id is not null) as has_confirmed_cause,
    1 - (ikc.embedding <=> query_embedding) as similarity
  from public.incident_knowledge_chunks ikc
  join public.incidents i on i.id = ikc.incident_id
  where ikc.embedding is not null
    and (filter_machine_model_id is null or i.machine_model_id = filter_machine_model_id)
    and (exclude_incident_id is null or i.id <> exclude_incident_id)
    and (filter_embedding_model is null or ikc.embedding_model = filter_embedding_model)
  order by ikc.embedding <=> query_embedding
  limit match_count;
$$;
