-- =============================================================================
-- 0003_incidents.sql — incidents, messages, symptoms, tests, causes, solutions
-- =============================================================================
-- The technical history: the "H" in the architecture (spec §5, §11).

-- --- Enums -------------------------------------------------------------------
create type incident_status as enum (
  'new', 'investigating', 'waiting_client', 'waiting_supplier',
  'resolved', 'closed', 'reopened'
);
create type incident_severity as enum ('low', 'normal', 'high', 'critical');
create type message_author as enum ('user', 'assistant', 'system');
create type test_run_status as enum (
  'proposed', 'in_progress', 'passed', 'failed',
  'inconclusive', 'not_applicable', 'cancelled'
);
create type risk_level as enum ('low', 'normal', 'high');
-- A cause never reaches 'confirmed' without human validation (spec §11, §2.4).
create type cause_status as enum ('hypothesis', 'eliminated', 'probable', 'confirmed');

-- --- incidents ---------------------------------------------------------------
create table public.incidents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  incident_number     text not null,
  client_id           uuid references public.clients (id) on delete set null,
  machine_id          uuid references public.machines (id) on delete set null,
  machine_model_id    uuid references public.machine_models (id) on delete set null,
  title               text not null,
  description_initial text,
  status              incident_status not null default 'new',
  severity            incident_severity not null default 'normal',
  current_summary     text,
  confirmed_cause_id  uuid,  -- FK to incident_causes added below (circular dep)
  created_by          uuid references public.profiles (id) on delete set null,
  assigned_to         uuid references public.profiles (id) on delete set null,
  opened_at           timestamptz not null default now(),
  resolved_at         timestamptz,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, incident_number)
);

create index incidents_organization_id_idx on public.incidents (organization_id);
create index incidents_client_id_idx on public.incidents (client_id);
create index incidents_machine_id_idx on public.incidents (machine_id);
create index incidents_machine_model_id_idx on public.incidents (machine_model_id);
create index incidents_status_idx on public.incidents (status);

create trigger incidents_set_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- --- incident_messages -------------------------------------------------------
-- Chat transcript. Assistant messages carry a structured JSON payload that the
-- UI renders (spec §36) so the model never controls raw presentation.
create table public.incident_messages (
  id                       uuid primary key default gen_random_uuid(),
  incident_id              uuid not null references public.incidents (id) on delete cascade,
  author_type              message_author not null,
  author_user_id           uuid references public.profiles (id) on delete set null,
  content                  text,
  structured_content_json  jsonb,
  created_at               timestamptz not null default now()
);

create index incident_messages_incident_id_idx on public.incident_messages (incident_id, created_at);

-- --- incident_symptoms -------------------------------------------------------
create table public.incident_symptoms (
  id                 uuid primary key default gen_random_uuid(),
  incident_id        uuid not null references public.incidents (id) on delete cascade,
  symptom_text       text not null,
  normalized_symptom text,
  component_id       uuid references public.components (id) on delete set null,
  confirmed          boolean not null default false,
  source_message_id  uuid references public.incident_messages (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index incident_symptoms_incident_id_idx on public.incident_symptoms (incident_id);

-- --- diagnostic_tests --------------------------------------------------------
-- Catalogue of known tests (spec §11). procedure_id FK added in 0004 once the
-- documents table exists.
create table public.diagnostic_tests (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  machine_model_id      uuid references public.machine_models (id) on delete cascade,
  component_id          uuid references public.components (id) on delete set null,
  code                  text,
  title                 text not null,
  description           text,
  instructions          text,
  expected_results_json jsonb,
  risk_level            risk_level not null default 'normal',
  procedure_id          uuid,  -- FK -> documents added in 0004
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index diagnostic_tests_organization_id_idx on public.diagnostic_tests (organization_id);
create index diagnostic_tests_machine_model_id_idx on public.diagnostic_tests (machine_model_id);

create trigger diagnostic_tests_set_updated_at
  before update on public.diagnostic_tests
  for each row execute function public.set_updated_at();

-- --- incident_test_runs ------------------------------------------------------
-- Each test actually performed on an incident (spec §11, §22).
create table public.incident_test_runs (
  id                 uuid primary key default gen_random_uuid(),
  incident_id        uuid not null references public.incidents (id) on delete cascade,
  diagnostic_test_id uuid references public.diagnostic_tests (id) on delete set null,
  proposed_by        message_author not null default 'assistant',
  performed_by       uuid references public.profiles (id) on delete set null,
  status             test_run_status not null default 'proposed',
  result             text,
  result_notes       text,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index incident_test_runs_incident_id_idx on public.incident_test_runs (incident_id);

-- --- causes ------------------------------------------------------------------
-- Catalogue of known technical causes (spec §11).
create table public.causes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  machine_model_id uuid references public.machine_models (id) on delete cascade,
  component_id     uuid references public.components (id) on delete set null,
  name             text not null,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index causes_organization_id_idx on public.causes (organization_id);

create trigger causes_set_updated_at
  before update on public.causes
  for each row execute function public.set_updated_at();

-- --- incident_causes ---------------------------------------------------------
-- A candidate cause for a specific incident. Only a human may set status to
-- 'confirmed' (spec §11) — enforced in application code + audited.
create table public.incident_causes (
  id               uuid primary key default gen_random_uuid(),
  incident_id      uuid not null references public.incidents (id) on delete cascade,
  cause_id         uuid references public.causes (id) on delete set null,
  status           cause_status not null default 'hypothesis',
  confidence_level text,
  evidence         text,
  validated_by     uuid references public.profiles (id) on delete set null,
  validated_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index incident_causes_incident_id_idx on public.incident_causes (incident_id);

-- Now that incident_causes exists, wire the incidents.confirmed_cause_id FK.
alter table public.incidents
  add constraint incidents_confirmed_cause_fk
  foreign key (confirmed_cause_id) references public.incident_causes (id) on delete set null;

-- --- solutions ---------------------------------------------------------------
create table public.solutions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  machine_model_id uuid references public.machine_models (id) on delete cascade,
  component_id     uuid references public.components (id) on delete set null,
  title            text not null,
  description      text,
  procedure_id     uuid,  -- FK -> documents added in 0004
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index solutions_organization_id_idx on public.solutions (organization_id);

create trigger solutions_set_updated_at
  before update on public.solutions
  for each row execute function public.set_updated_at();

-- --- incident_solutions ------------------------------------------------------
create table public.incident_solutions (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references public.incidents (id) on delete cascade,
  solution_id   uuid references public.solutions (id) on delete set null,
  solution_text text,
  result        text,
  validated     boolean not null default false,
  validated_by  uuid references public.profiles (id) on delete set null,
  validated_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index incident_solutions_incident_id_idx on public.incident_solutions (incident_id);
