-- =============================================================================
-- 0009_search_functions.sql — retrieval RPCs (spec §17)
-- =============================================================================
-- The retrieval pipeline (lib/rag) calls these via PostgREST rpc(). They run
-- as SECURITY INVOKER so the caller's RLS still applies: a user only ever
-- searches rows in their own organization.
--
-- Two families:
--   * semantic — pgvector cosine distance over embeddings (§17 step 3)
--   * keyword  — Postgres full-text search over content_tsv (§17 step 4)
-- Fusion of the two happens in TypeScript (lib/rag/hybrid-search.ts, §17 step 6)
-- so the ranking weights stay in one place and are unit-testable.

-- --- Semantic search over approved-document chunks --------------------------
create or replace function public.match_document_chunks(
  query_embedding vector(1024),
  match_count int default 30,
  filter_machine_model_id uuid default null
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
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- --- Keyword search over document chunks ------------------------------------
create or replace function public.keyword_document_chunks(
  query_text text,
  match_count int default 30,
  filter_machine_model_id uuid default null
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
  rank float
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
    ts_rank(dc.content_tsv, websearch_to_tsquery('french', query_text)) as rank
  from public.document_chunks dc
  join public.document_versions dv on dv.id = dc.document_version_id
  join public.documents d on d.id = dv.document_id
  where d.status = 'approved'
    and dc.content_tsv @@ websearch_to_tsquery('french', query_text)
    and (filter_machine_model_id is null or d.machine_model_id = filter_machine_model_id)
  order by rank desc
  limit match_count;
$$;

-- --- Semantic search over validated incident knowledge ----------------------
create or replace function public.match_incident_chunks(
  query_embedding vector(1024),
  match_count int default 30,
  filter_machine_model_id uuid default null,
  exclude_incident_id uuid default null
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
  order by ikc.embedding <=> query_embedding
  limit match_count;
$$;

-- --- Keyword search over validated incident knowledge -----------------------
create or replace function public.keyword_incident_chunks(
  query_text text,
  match_count int default 30,
  filter_machine_model_id uuid default null,
  exclude_incident_id uuid default null
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
  rank float
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
    ts_rank(ikc.content_tsv, websearch_to_tsquery('french', query_text)) as rank
  from public.incident_knowledge_chunks ikc
  join public.incidents i on i.id = ikc.incident_id
  where ikc.content_tsv @@ websearch_to_tsquery('french', query_text)
    and (filter_machine_model_id is null or i.machine_model_id = filter_machine_model_id)
    and (exclude_incident_id is null or i.id <> exclude_incident_id)
  order by rank desc
  limit match_count;
$$;
