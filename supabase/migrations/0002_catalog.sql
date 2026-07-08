-- =============================================================================
-- 0002_catalog.sql — clients, machine models, components, physical machines
-- =============================================================================
-- The "who" and "what" of Symp's: customers, machine families, the component
-- hierarchy (spec §9), and individual physical machines.

-- --- clients -----------------------------------------------------------------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  company_name     text,
  email            text,
  phone            text,
  odoo_external_id text,             -- reserved for the future Odoo link (spec §9 phase)
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index clients_organization_id_idx on public.clients (organization_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- --- machine_models ----------------------------------------------------------
-- Machine families: M1, Opaline, Graphite, ... (spec §11). V1 scope is M1 +
-- Opaline (spec §4) but the table holds the full range.
create table public.machine_models (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  slug             text not null,
  description      text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

create index machine_models_organization_id_idx on public.machine_models (organization_id);

create trigger machine_models_set_updated_at
  before update on public.machine_models
  for each row execute function public.set_updated_at();

-- --- components --------------------------------------------------------------
-- Self-referential hierarchy per machine model (spec §9):
-- M1 → Communication → Carte principale → Alimentation
create table public.components (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  machine_model_id     uuid not null references public.machine_models (id) on delete cascade,
  parent_component_id  uuid references public.components (id) on delete cascade,
  name                 text not null,
  slug                 text not null,
  description          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (machine_model_id, parent_component_id, slug)
);

create index components_organization_id_idx on public.components (organization_id);
create index components_machine_model_id_idx on public.components (machine_model_id);
create index components_parent_idx on public.components (parent_component_id);

create trigger components_set_updated_at
  before update on public.components
  for each row execute function public.set_updated_at();

-- --- machines ----------------------------------------------------------------
-- One row = one physical machine at a client site (spec §11, §25).
create type machine_status as enum ('active', 'inactive', 'decommissioned');

create table public.machines (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  client_id           uuid references public.clients (id) on delete set null,
  machine_model_id    uuid not null references public.machine_models (id) on delete restrict,
  serial_number       text,
  internal_reference  text,
  installation_date   date,
  status              machine_status not null default 'active',
  software_version    text,
  configuration_json  jsonb not null default '{}'::jsonb,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index machines_organization_id_idx on public.machines (organization_id);
create index machines_client_id_idx on public.machines (client_id);
create index machines_machine_model_id_idx on public.machines (machine_model_id);
create unique index machines_serial_number_idx
  on public.machines (organization_id, serial_number)
  where serial_number is not null;

create trigger machines_set_updated_at
  before update on public.machines
  for each row execute function public.set_updated_at();
