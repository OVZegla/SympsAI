-- =============================================================================
-- 0010_statistics.sql — aggregate views for the statistics screen (spec §45)
-- =============================================================================
-- Views run as SECURITY INVOKER, so a user only ever aggregates rows in their
-- own organization (RLS on the base tables applies). Each view carries
-- organization_id so the app can filter/scope explicitly too.

-- Incidents per machine model (spec §45).
create or replace view public.stats_incidents_by_model as
select
  i.organization_id,
  i.machine_model_id,
  mm.name as machine_model_name,
  count(*)::int as incident_count
from public.incidents i
left join public.machine_models mm on mm.id = i.machine_model_id
group by i.organization_id, i.machine_model_id, mm.name;

-- Incidents per (top-level) component, via confirmed causes (spec §45).
create or replace view public.stats_incidents_by_component as
select
  c.organization_id,
  c.id as component_id,
  c.name as component_name,
  count(distinct ic.incident_id)::int as incident_count
from public.incident_causes ic
join public.causes ca on ca.id = ic.cause_id
join public.components c on c.id = ca.component_id
where ic.status = 'confirmed'
group by c.organization_id, c.id, c.name;

-- Frequent confirmed causes (spec §45) — the recurrence signal (§45 "taux de
-- récurrence"): how many incidents shared each confirmed cause.
create or replace view public.stats_frequent_causes as
select
  ca.organization_id,
  ca.id as cause_id,
  ca.name as cause_name,
  count(distinct ic.incident_id)::int as incident_count
from public.incident_causes ic
join public.causes ca on ca.id = ic.cause_id
where ic.status = 'confirmed'
group by ca.organization_id, ca.id, ca.name;
