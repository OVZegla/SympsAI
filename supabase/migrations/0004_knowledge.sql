-- =============================================================================
-- 0004_knowledge.sql — documents, versions, RAG chunks, incident knowledge
-- =============================================================================
-- The knowledge base: procedures, manuals, notes, plus the searchable chunks
-- used by RAG (spec §11, §28-§33). Embedding dimension matches EMBEDDING_DIMENSION
-- (voyage-4 → 1024, spec §55). If you change the embedding model's dimension,
-- add a migration that alters these vector(1024) columns.

-- --- Enums -------------------------------------------------------------------
create type document_type as enum (
  'procedure', 'manual', 'technical_note', 'configuration',
  'training', 'troubleshooting', 'other'
);
create type document_status as enum ('draft', 'review', 'approved', 'archived');

-- --- documents ---------------------------------------------------------------
create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  document_code      text,                    -- e.g. PROC-M1-COM-003
  title              text not null,
  description        text,
  document_type      document_type not null default 'other',
  status             document_status not null default 'draft',
  current_version_id uuid,                    -- FK to document_versions added below
  machine_model_id   uuid references public.machine_models (id) on delete set null,
  component_id       uuid references public.components (id) on delete set null,
  language           text default 'fr',
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, document_code)
);

create index documents_organization_id_idx on public.documents (organization_id);
create index documents_status_idx on public.documents (status);
create index documents_machine_model_id_idx on public.documents (machine_model_id);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- --- document_versions -------------------------------------------------------
-- Keeping every version matters: old incidents must keep showing which version
-- was used at diagnosis time (spec §11).
create table public.document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents (id) on delete cascade,
  version_number int not null,
  storage_path   text,                        -- Supabase Storage path to the file
  mime_type      text,
  file_size      bigint,
  checksum       text,
  change_summary text,
  approved_by    uuid references public.profiles (id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (document_id, version_number)
);

create index document_versions_document_id_idx on public.document_versions (document_id);

-- Wire documents.current_version_id now that document_versions exists.
alter table public.documents
  add constraint documents_current_version_fk
  foreign key (current_version_id) references public.document_versions (id) on delete set null;

-- Wire the deferred procedure_id FKs from 0003.
alter table public.diagnostic_tests
  add constraint diagnostic_tests_procedure_fk
  foreign key (procedure_id) references public.documents (id) on delete set null;
alter table public.solutions
  add constraint solutions_procedure_fk
  foreign key (procedure_id) references public.documents (id) on delete set null;

-- --- document_chunks ---------------------------------------------------------
-- Content used for RAG retrieval (spec §11, §29). Structure-aware chunks of
-- ~500-800 tokens with metadata that supports citations.
create table public.document_chunks (
  id                  uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  chunk_index         int not null,
  content             text not null,
  heading             text,
  page_number         int,
  source_location     text,
  token_count         int,
  embedding           vector(1024),
  metadata_json       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (document_version_id, chunk_index)
);

create index document_chunks_version_idx on public.document_chunks (document_version_id);
-- Full-text search over chunk content (spec §17 step 4). French config; the
-- generated tsvector keeps keyword search in sync with content.
alter table public.document_chunks
  add column content_tsv tsvector
  generated always as (to_tsvector('french', coalesce(content, ''))) stored;
create index document_chunks_tsv_idx on public.document_chunks using gin (content_tsv);
-- Approximate nearest-neighbour index for semantic search (spec §17 step 3).
create index document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- --- incident_knowledge_chunks ----------------------------------------------
-- Validated incidents are searched separately from documents (spec §11, §18)
-- so an unresolved conversation cannot overwrite an official procedure.
create type incident_knowledge_type as enum (
  'symptoms', 'diagnostic_path', 'confirmed_cause',
  'validated_solution', 'final_summary'
);

create table public.incident_knowledge_chunks (
  id             uuid primary key default gen_random_uuid(),
  incident_id    uuid not null references public.incidents (id) on delete cascade,
  content        text not null,
  knowledge_type incident_knowledge_type not null,
  embedding      vector(1024),
  created_at     timestamptz not null default now()
);

create index incident_knowledge_chunks_incident_idx
  on public.incident_knowledge_chunks (incident_id);
alter table public.incident_knowledge_chunks
  add column content_tsv tsvector
  generated always as (to_tsvector('french', coalesce(content, ''))) stored;
create index incident_knowledge_chunks_tsv_idx
  on public.incident_knowledge_chunks using gin (content_tsv);
create index incident_knowledge_chunks_embedding_idx
  on public.incident_knowledge_chunks using hnsw (embedding vector_cosine_ops);
