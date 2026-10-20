-- Foto de perfil. Bucket público de solo lectura por enlace; cada persona escribe solo en su propia carpeta ({su id}/…).
-- La foto se ve entre integrantes de una banda y, si el perfil es público (solo mayores de edad), en Comunidad.
-- Límites del bucket: 2 MB y solo JPEG, PNG o WebP; el cliente además la recorta, reduce y le quita EXIF/GPS. Repetible.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists profile_media_insert on storage.objects;
create policy profile_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists profile_media_delete on storage.objects;
create policy profile_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Listar (para limpiar al borrar la cuenta) solo la propia carpeta.
drop policy if exists profile_media_list on storage.objects;
create policy profile_media_list on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.profiles
  add column if not exists avatar_path text check (avatar_path is null or (char_length(avatar_path) <= 200 and avatar_path like id::text || '/%'));
grant update (avatar_path) on public.profiles to authenticated;
grant select (avatar_path) on public.profiles to authenticated;

-- Integrantes visibles de una banda pública, ahora con su foto.
drop function if exists public.band_public_members(uuid);
create function public.band_public_members(p_band uuid)
returns table (profile_id uuid, display_name text, instrument text, instruments text[], role text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select m.profile_id, p.display_name, m.instrument, p.instruments, m.role, p.avatar_path
  from public.band_members m
  join public.profiles p on p.id = m.profile_id
  where m.band_id = p_band and p.is_public and public.band_is_public(p_band)
  order by (m.role = 'owner') desc, p.display_name;
$$;
revoke all on function public.band_public_members from public, anon;
grant execute on function public.band_public_members to authenticated;
