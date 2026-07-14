-- =============================================================================
-- 0014_machine_profile.sql — profil machine détaillé (Base Symp's, §11 du
-- cahier d'intégration)
-- =============================================================================
-- Une règle peut n'être valable que pour certaines générations/versions : le
-- diagnostic doit pouvoir différencier génération, montage, type de tête et
-- versions logicielles. `software_version`, `installation_date`,
-- `serial_number` et `notes` existent déjà sur machines.

alter table public.machines
  add column if not exists generation text,
  add column if not exists mounting_type text, -- ancien / nouveau montage
  add column if not exists head_type text,
  add column if not exists betterprinter_version text,
  add column if not exists ultraprint_version text,
  add column if not exists modifications text,   -- modifications déjà réalisées
  add column if not exists replaced_parts text;  -- pièces déjà remplacées
