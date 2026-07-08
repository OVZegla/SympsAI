-- =============================================================================
-- seed.sql — minimal seed for local development (spec §4 V1 scope: M1 + Opaline)
-- =============================================================================
-- Run against a local Supabase after the migrations. Idempotent-ish: it keys on
-- stable slugs/codes so re-running does not duplicate core rows. It does NOT
-- create auth users — add those via the admin UI or Supabase dashboard so the
-- handle_new_user trigger provisions their profile.

-- --- Organization ------------------------------------------------------------
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Symp''s')
on conflict (id) do nothing;

-- --- Machine models (V1 scope) ----------------------------------------------
insert into public.machine_models (organization_id, name, slug, description, active)
values
  ('00000000-0000-0000-0000-000000000001', 'M1', 'm1', 'Machine M1', true),
  ('00000000-0000-0000-0000-000000000001', 'Opaline', 'opaline', 'Machine Opaline', true)
on conflict (organization_id, slug) do nothing;

-- --- M1 component hierarchy (spec §9) ---------------------------------------
-- Top-level systems, then the Communication → Carte principale → Alimentation
-- chain used by the reference diagnostic scenario (spec §66).
do $$
declare
  org uuid := '00000000-0000-0000-0000-000000000001';
  m1  uuid;
  communication uuid;
  main_board uuid;
begin
  select id into m1 from public.machine_models
   where organization_id = org and slug = 'm1';

  -- Top-level systems.
  insert into public.components (organization_id, machine_model_id, name, slug)
  values
    (org, m1, 'Impression', 'impression'),
    (org, m1, 'Communication', 'communication'),
    (org, m1, 'Déplacement', 'deplacement'),
    (org, m1, 'Encre', 'encre'),
    (org, m1, 'UV', 'uv'),
    (org, m1, 'Détection', 'detection'),
    (org, m1, 'Informatique', 'informatique')
  on conflict (machine_model_id, parent_component_id, slug) do nothing;

  select id into communication from public.components
   where machine_model_id = m1 and slug = 'communication' and parent_component_id is null;

  insert into public.components (organization_id, machine_model_id, parent_component_id, name, slug)
  values
    (org, m1, communication, 'PC', 'pc'),
    (org, m1, communication, 'Câble signal', 'cable-signal'),
    (org, m1, communication, 'Carte principale', 'carte-principale'),
    (org, m1, communication, 'Connectique', 'connectique')
  on conflict (machine_model_id, parent_component_id, slug) do nothing;

  select id into main_board from public.components
   where machine_model_id = m1 and slug = 'carte-principale'
     and parent_component_id = communication;

  insert into public.components (organization_id, machine_model_id, parent_component_id, name, slug)
  values
    (org, m1, main_board, 'Alimentation', 'alimentation')
  on conflict (machine_model_id, parent_component_id, slug) do nothing;
end $$;
