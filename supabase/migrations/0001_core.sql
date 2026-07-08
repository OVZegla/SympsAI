-- =============================================================================
-- 0001_core.sql — extensions, shared helpers, organizations, profiles
-- =============================================================================
-- Symp's AI database schema. See cahier des charges §11.
-- Multi-tenant-ready from day one via organization_id, even though Symp's is
-- the only organization for now (spec §11).

-- --- Extensions --------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector, for embeddings (spec §6)
create extension if not exists "pg_trgm";    -- trigram search, helps keyword search

-- --- Shared trigger: keep updated_at current ---------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Enums -------------------------------------------------------------------
create type user_role as enum ('admin', 'technician', 'viewer');

-- --- organizations -----------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- --- profiles ----------------------------------------------------------------
-- One row per auth.users row. `id` mirrors the Supabase Auth user id.
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name       text,
  email           text not null,
  role            user_role not null default 'technician',
  avatar_url      text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- --- Auth helpers ------------------------------------------------------------
-- Resolve the calling user's organization and role from their profile. Marked
-- STABLE + SECURITY DEFINER so RLS policies can call them without recursing
-- through profiles' own policies.
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- A user can write technical data if they are admin or technician (spec §8).
create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'technician'), false);
$$;
