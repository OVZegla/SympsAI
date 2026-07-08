-- =============================================================================
-- 0007_auth_profile.sql — auto-provision a profile for each new auth user
-- =============================================================================
-- There is no public sign-up: an admin adds users (spec §13). When an admin
-- creates a Supabase Auth user, this trigger creates the matching profile.
--
-- V1 convenience: since Symp's is the only organization, new users are attached
-- to the single existing organization. When true multi-tenancy arrives, replace
-- this with an invitation flow that carries the target organization_id in the
-- user's metadata (raw_user_meta_data->>'organization_id').

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  desired_role user_role;
begin
  -- Prefer an explicit organization in the invite metadata; otherwise fall back
  -- to the single V1 organization.
  target_org := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;
  if target_org is null then
    select id into target_org from public.organizations order by created_at asc limit 1;
  end if;

  -- Role defaults to technician unless the invite specifies otherwise.
  desired_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::user_role,
    'technician'
  );

  if target_org is not null then
    insert into public.profiles (id, organization_id, full_name, email, role)
    values (
      new.id,
      target_org,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email,
      desired_role
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
