-- =============================================================================
-- 0005_ops.sql — attachments, tags, observability, feedback, audit
-- =============================================================================
-- Supporting tables: files, tagging, and the observability trail that explains
-- WHY the AI answered something (spec §11, §48).

-- --- attachments -------------------------------------------------------------
create type attachment_type as enum (
  'photo', 'screenshot', 'video', 'pdf', 'log', 'configuration', 'other'
);

create table public.attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  incident_id      uuid references public.incidents (id) on delete cascade,
  message_id       uuid references public.incident_messages (id) on delete set null,
  storage_path     text not null,             -- Supabase Storage path
  filename         text,
  mime_type        text,
  attachment_type  attachment_type not null default 'other',
  description      text,
  uploaded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index attachments_organization_id_idx on public.attachments (organization_id);
create index attachments_incident_id_idx on public.attachments (incident_id);

-- --- tags --------------------------------------------------------------------
create table public.tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  type             text,
  unique (organization_id, name)
);

create index tags_organization_id_idx on public.tags (organization_id);

-- Join: tags applied to incidents (the primary tagging target in V1).
create table public.incident_tags (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  primary key (incident_id, tag_id)
);

-- --- retrieval_runs ----------------------------------------------------------
-- Records what the retrieval pipeline found and fed to the model, so a bad
-- answer can be traced back to bad retrieval (spec §11, §48).
create table public.retrieval_runs (
  id                        uuid primary key default gen_random_uuid(),
  incident_id               uuid references public.incidents (id) on delete cascade,
  user_query                text,
  parsed_query_json         jsonb,
  filters_json              jsonb,
  retrieved_documents_json  jsonb,
  retrieved_incidents_json  jsonb,
  final_context_json        jsonb,
  created_at                timestamptz not null default now()
);

create index retrieval_runs_incident_id_idx on public.retrieval_runs (incident_id);

-- --- ai_runs -----------------------------------------------------------------
-- One row per model call (spec §11, §48). Model + prompt_version are recorded
-- so a behaviour change can be tied to a specific prompt (spec §49).
create table public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  incident_id    uuid references public.incidents (id) on delete cascade,
  message_id     uuid references public.incident_messages (id) on delete set null,
  model          text,
  prompt_version text,
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  status         text,
  error          text,
  created_at     timestamptz not null default now()
);

create index ai_runs_incident_id_idx on public.ai_runs (incident_id);

-- --- feedback ----------------------------------------------------------------
create type feedback_type as enum (
  'helpful', 'incorrect', 'wrong_document', 'unsafe', 'incomplete', 'other'
);

create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid references public.incident_messages (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  rating        int,
  feedback_type feedback_type,
  comment       text,
  created_at    timestamptz not null default now()
);

create index feedback_message_id_idx on public.feedback (message_id);

-- --- audit_logs --------------------------------------------------------------
-- Sensitive actions: cause validation, procedure publication, deletion,
-- knowledge modification, role change (spec §11).
create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete set null,
  action           text not null,
  entity_type      text,
  entity_id        uuid,
  before_json      jsonb,
  after_json       jsonb,
  created_at       timestamptz not null default now()
);

create index audit_logs_organization_id_idx on public.audit_logs (organization_id, created_at);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
