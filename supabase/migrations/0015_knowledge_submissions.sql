-- =============================================================================
-- 0015_knowledge_submissions.sql — mode apprentissage contrôlé (§16-§17E)
-- =============================================================================
-- Une connaissance apprise pendant un incident ne devient JAMAIS confirmée
-- automatiquement : elle est soumise ici en PENDING_REVIEW et n'entre dans le
-- contexte du diagnostic qu'après validation par un admin. Les faits CONFIRMED
-- sont injectés à côté de la Base Symp's v0.1 avec la mention « validation
-- interne » comme source.

create table if not exists public.knowledge_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Le fait proposé, formulé comme une règle/un fait réutilisable.
  statement text not null,
  category text not null default 'terrain',
  -- Mots-clés (séparés par des virgules) qui déclenchent l'injection du fait.
  keywords text,
  machine_model_id uuid references public.machine_models(id) on delete set null,
  -- D'où vient la connaissance (traçabilité §14).
  incident_id uuid references public.incidents(id) on delete set null,
  source_note text,
  status text not null default 'PENDING_REVIEW'
    check (status in ('DRAFT', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'DEPRECATED')),
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_submissions_org_status_idx
  on public.knowledge_submissions (organization_id, status);

alter table public.knowledge_submissions enable row level security;

-- Lecture : tous les membres de l'organisation.
create policy knowledge_submissions_select on public.knowledge_submissions
  for select using (organization_id = public.current_organization_id());

-- Proposition : tout membre qui peut écrire.
create policy knowledge_submissions_insert on public.knowledge_submissions
  for insert with check (
    organization_id = public.current_organization_id() and public.can_write()
  );

-- Validation/rejet : admins uniquement.
create policy knowledge_submissions_update on public.knowledge_submissions
  for update using (
    organization_id = public.current_organization_id() and public.is_admin()
  );

create policy knowledge_submissions_delete on public.knowledge_submissions
  for delete using (
    organization_id = public.current_organization_id() and public.is_admin()
  );

-- Droits de base (même logique que 0012_grants).
grant select, insert, update, delete on public.knowledge_submissions to authenticated;
grant select on public.knowledge_submissions to anon;
grant all on public.knowledge_submissions to service_role;
