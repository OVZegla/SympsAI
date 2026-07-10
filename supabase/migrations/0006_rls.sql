-- =============================================================================
-- 0006_rls.sql — Row Level Security on every application table (spec §46)
-- =============================================================================
-- Baseline rule: a user only sees/touches rows whose organization_id matches
-- their own (public.current_organization_id()). Writes to technical data
-- require the technician/admin role (public.can_write()); deletions and user
-- management are admin-only. Sensitive status transitions (publishing a
-- procedure, confirming a cause, closing an incident) are additionally gated
-- in the application/API layer and recorded in audit_logs — RLS is the floor,
-- not the whole story (spec §24, §2.4).
--
-- The service-role key bypasses RLS entirely and is used only by trusted
-- server code (lib/supabase/admin.ts). It must never reach the browser (§47).

-- --- Enable RLS everywhere ---------------------------------------------------
alter table public.organizations             enable row level security;
alter table public.profiles                  enable row level security;
alter table public.clients                   enable row level security;
alter table public.machine_models            enable row level security;
alter table public.components                 enable row level security;
alter table public.machines                   enable row level security;
alter table public.incidents                  enable row level security;
alter table public.incident_messages          enable row level security;
alter table public.incident_symptoms          enable row level security;
alter table public.diagnostic_tests           enable row level security;
alter table public.incident_test_runs         enable row level security;
alter table public.causes                     enable row level security;
alter table public.incident_causes            enable row level security;
alter table public.solutions                  enable row level security;
alter table public.incident_solutions         enable row level security;
alter table public.documents                  enable row level security;
alter table public.document_versions          enable row level security;
alter table public.document_chunks            enable row level security;
alter table public.incident_knowledge_chunks  enable row level security;
alter table public.attachments                enable row level security;
alter table public.tags                       enable row level security;
alter table public.incident_tags              enable row level security;
alter table public.retrieval_runs             enable row level security;
alter table public.ai_runs                    enable row level security;
alter table public.feedback                   enable row level security;
alter table public.audit_logs                 enable row level security;

-- =============================================================================
-- organizations & profiles
-- =============================================================================
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_organization_id());

create policy profiles_select on public.profiles
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- A user may update their own non-privileged profile fields; role changes are
-- an admin action (also audited in the app layer).
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin() and organization_id = public.current_organization_id())
  with check (public.is_admin() and organization_id = public.current_organization_id());

-- =============================================================================
-- Org-scoped tables: SELECT for everyone in org, WRITE for can_write(),
-- DELETE for admins. Applied uniformly to tables that carry organization_id.
-- =============================================================================
do $$
declare
  t text;
  -- Tables that carry an organization_id column directly. retrieval_runs and
  -- ai_runs do NOT (they are observability logs tied to an incident) — they get
  -- their own incident-scoped policies below.
  org_tables text[] := array[
    'clients', 'machine_models', 'components', 'machines',
    'incidents', 'diagnostic_tests', 'causes', 'solutions',
    'documents', 'attachments', 'tags'
  ];
begin
  foreach t in array org_tables loop
    execute format($f$
      create policy %1$s_select on public.%1$s
        for select to authenticated
        using (organization_id = public.current_organization_id());
    $f$, t);

    execute format($f$
      create policy %1$s_insert on public.%1$s
        for insert to authenticated
        with check (
          public.can_write()
          and organization_id = public.current_organization_id()
        );
    $f$, t);

    execute format($f$
      create policy %1$s_update on public.%1$s
        for update to authenticated
        using (
          public.can_write()
          and organization_id = public.current_organization_id()
        )
        with check (organization_id = public.current_organization_id());
    $f$, t);

    execute format($f$
      create policy %1$s_delete on public.%1$s
        for delete to authenticated
        using (
          public.is_admin()
          and organization_id = public.current_organization_id()
        );
    $f$, t);
  end loop;
end $$;

-- =============================================================================
-- audit_logs: readable by admins, insertable by any authenticated user in org
-- (the app writes audit entries as the acting user), never updated or deleted.
-- =============================================================================
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin() and organization_id = public.current_organization_id());

create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (organization_id = public.current_organization_id());

-- =============================================================================
-- retrieval_runs & ai_runs: internal observability (spec §48). No
-- organization_id column — authorize through the linked incident's org. A row
-- with no incident (e.g. a standalone AI run) is allowed within the org. Reads
-- are admin-only, like audit_logs.
-- =============================================================================
do $$
declare
  t text;
  log_tables text[] := array['retrieval_runs', 'ai_runs'];
begin
  foreach t in array log_tables loop
    execute format($f$
      create policy %1$s_select on public.%1$s
        for select to authenticated
        using (public.is_admin() and (
          incident_id is null or exists (
            select 1 from public.incidents i
            where i.id = %1$s.incident_id
              and i.organization_id = public.current_organization_id()
          )
        ));
    $f$, t);

    execute format($f$
      create policy %1$s_insert on public.%1$s
        for insert to authenticated
        with check (
          incident_id is null or exists (
            select 1 from public.incidents i
            where i.id = %1$s.incident_id
              and i.organization_id = public.current_organization_id()
          )
        );
    $f$, t);
  end loop;
end $$;

-- =============================================================================
-- Incident child tables: authorize through the parent incident's org.
-- =============================================================================
do $$
declare
  t text;
  child_tables text[] := array[
    'incident_messages', 'incident_symptoms', 'incident_test_runs',
    'incident_causes', 'incident_solutions', 'incident_knowledge_chunks',
    'incident_tags'
  ];
begin
  foreach t in array child_tables loop
    execute format($f$
      create policy %1$s_select on public.%1$s
        for select to authenticated
        using (exists (
          select 1 from public.incidents i
          where i.id = %1$s.incident_id
            and i.organization_id = public.current_organization_id()
        ));
    $f$, t);

    execute format($f$
      create policy %1$s_write on public.%1$s
        for all to authenticated
        using (public.can_write() and exists (
          select 1 from public.incidents i
          where i.id = %1$s.incident_id
            and i.organization_id = public.current_organization_id()
        ))
        with check (public.can_write() and exists (
          select 1 from public.incidents i
          where i.id = %1$s.incident_id
            and i.organization_id = public.current_organization_id()
        ));
    $f$, t);
  end loop;
end $$;

-- =============================================================================
-- Document child tables: authorize through the parent document's org.
-- =============================================================================
create policy document_versions_select on public.document_versions
  for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_versions.document_id
      and d.organization_id = public.current_organization_id()
  ));

create policy document_versions_write on public.document_versions
  for all to authenticated
  using (public.can_write() and exists (
    select 1 from public.documents d
    where d.id = document_versions.document_id
      and d.organization_id = public.current_organization_id()
  ))
  with check (public.can_write() and exists (
    select 1 from public.documents d
    where d.id = document_versions.document_id
      and d.organization_id = public.current_organization_id()
  ));

create policy document_chunks_select on public.document_chunks
  for select to authenticated
  using (exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.id = document_chunks.document_version_id
      and d.organization_id = public.current_organization_id()
  ));

create policy document_chunks_write on public.document_chunks
  for all to authenticated
  using (public.can_write() and exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.id = document_chunks.document_version_id
      and d.organization_id = public.current_organization_id()
  ))
  with check (public.can_write() and exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.id = document_chunks.document_version_id
      and d.organization_id = public.current_organization_id()
  ));

-- =============================================================================
-- feedback: authorize through the message's incident org.
-- =============================================================================
create policy feedback_select on public.feedback
  for select to authenticated
  using (exists (
    select 1 from public.incident_messages m
    join public.incidents i on i.id = m.incident_id
    where m.id = feedback.message_id
      and i.organization_id = public.current_organization_id()
  ));

create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (exists (
    select 1 from public.incident_messages m
    join public.incidents i on i.id = m.incident_id
    where m.id = feedback.message_id
      and i.organization_id = public.current_organization_id()
  ));
