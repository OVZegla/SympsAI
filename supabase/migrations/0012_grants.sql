-- =============================================================================
-- 0012_grants.sql — grant table/function access to the Supabase API roles
-- =============================================================================
-- Row Level Security governs WHICH rows the API roles can touch, but the roles
-- still need the base table privilege to touch them at all. In some local
-- Supabase setups, tables created by migrations don't automatically inherit
-- these grants, which surfaces as `permission denied for table … (42501)` —
-- breaking every read/write, including profile creation at login.
--
-- We grant explicitly here (runs after all tables/functions exist) and set
-- default privileges so future objects inherit them too.
--
-- Safety: authenticated/anon get only DML (SELECT/INSERT/UPDATE/DELETE), which
-- RLS still restricts row-by-row — NOT TRUNCATE (which would bypass RLS).
-- service_role is trusted server-side code and bypasses RLS by design.

grant usage on schema public to anon, authenticated, service_role;

-- Existing objects
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Future objects (created by the migration role)
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
