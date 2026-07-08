-- =============================================================================
-- 0008_storage.sql — private Storage buckets for documents & attachments
-- =============================================================================
-- Files are private (spec §6): access goes through the app, which issues signed
-- URLs. Buckets are created here so the schema is reproducible from migrations
-- (principle #10). Object-level access is restricted to authenticated users;
-- finer per-organization path scoping can be layered on later.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Authenticated users may read/write objects in these buckets. The application
-- enforces organization scoping when it stores/reads paths; RLS on the metadata
-- tables (documents, attachments) governs who can see what a file belongs to.
create policy "authenticated can read app files"
  on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'attachments'));

create policy "authenticated can upload app files"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('documents', 'attachments'));

create policy "authenticated can update app files"
  on storage.objects for update to authenticated
  using (bucket_id in ('documents', 'attachments'));

create policy "authenticated can delete app files"
  on storage.objects for delete to authenticated
  using (bucket_id in ('documents', 'attachments'));
