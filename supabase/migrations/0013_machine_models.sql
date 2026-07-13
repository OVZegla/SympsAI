-- =============================================================================
-- 0013_machine_models.sql — extend the machine-model catalogue
-- =============================================================================
-- Adds the rest of the Symp's range (Graphite, White, T1000, Black 2.0, TUP,
-- Access) alongside the V1 seed models (M1, Opaline). Runs as a migration —
-- not seed.sql — so existing installations pick the models up on the next
-- `migration up` without a destructive `db reset`.
--
-- Idempotent: keyed on (organization_id, slug), applied to every organization.

insert into public.machine_models (organization_id, name, slug, description, active)
select o.id, v.name, v.slug, v.description, true
from public.organizations o
cross join (
  values
    ('Graphite',  'graphite',  'Machine Graphite'),
    ('White',     'white',     'Machine White'),
    ('T1000',     't1000',     'Machine T1000'),
    ('Black 2.0', 'black-2-0', 'Machine Black 2.0'),
    ('TUP',       'tup',       'Machine TUP'),
    ('Access',    'access',    'Machine Access')
) as v(name, slug, description)
on conflict (organization_id, slug) do nothing;
