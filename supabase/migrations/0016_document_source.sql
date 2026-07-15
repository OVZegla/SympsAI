-- =============================================================================
-- 0016_document_source.sql — provenance des documents (import Dropbox)
-- =============================================================================
-- Les documents peuvent venir d'un upload manuel ou d'une synchronisation du
-- cloud Dropbox. On trace le chemin distant et la révision Dropbox pour ne
-- réimporter un fichier que lorsqu'il a changé (nouvelle version, jamais
-- d'écrasement — spec §30 : l'original est toujours conservé).

alter table public.documents
  add column if not exists source text not null default 'upload'
    check (source in ('upload', 'dropbox')),
  add column if not exists source_path text,
  add column if not exists source_rev text;

create index if not exists documents_source_path_idx
  on public.documents (organization_id, source_path)
  where source_path is not null;
