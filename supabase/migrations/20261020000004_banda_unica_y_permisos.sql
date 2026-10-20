-- 1. Evita bandas duplicadas por doble clic: create_band es idempotente y hay un índice único de respaldo.

-- Limpia duplicados previos (mismo creador y nombre): conserva la más antigua.
-- Borra en cascada lo que cuelgue de las repetidas (canciones, setlists, miembros).
delete from public.bands b
using public.bands keep
where b.created_by = keep.created_by
  and lower(b.name) = lower(keep.name)
  and (keep.created_at, keep.id) < (b.created_at, b.id);

create unique index bands_creator_name_uniq on public.bands (created_by, lower(name));

create or replace function public.create_band(p_name text, p_city text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select id into new_id from public.bands
    where created_by = (select auth.uid()) and lower(name) = lower(trim(p_name));
  if found then return new_id; end if;
  insert into public.bands (name, city, created_by) values (trim(p_name), p_city, (select auth.uid())) returning id into new_id;
  insert into public.band_members (band_id, profile_id, role) values (new_id, (select auth.uid()), 'owner');
  return new_id;
end $$;

-- 2. Permisos sobrantes (Supabase los da por defecto; no se usan desde la API).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Nadie edita invitaciones: se crean, se leen y se borran.
revoke update on public.band_invites from authenticated;
