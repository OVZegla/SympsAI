-- =============================================================================
-- 0017_incident_sav.sql — fiche SAV / intervention (formulaire officiel Symp's)
-- =============================================================================
-- La fiche SAV d'un incident est pré-remplie depuis le dossier (client,
-- machine, tests, cause, solution) ; les champs édités/complétés par le
-- technicien sont conservés ici pour que la fiche soit rééditable et
-- réimprimable à l'identique.

alter table public.incidents
  add column if not exists sav_json jsonb;
