-- Comunidad: directorio de bandas y músicos con perfil público OPCIONAL (apagado por defecto).
--  - Una banda se publica si un admin lo decide; una persona se publica si ella lo decide y es mayor de edad.
--  - Lo ven solo personas con cuenta. Nunca se expone el correo ni los datos de aceptación de términos.
--  - Las canciones, setlists, agenda y reservas siguen siendo privados de la banda.
-- Repetible.

-- ───────── Visibilidad ─────────
alter table public.bands add column if not exists is_public boolean not null default false;
alter table public.profiles
  add column if not exists is_public boolean not null default false,
  add column if not exists whatsapp text check (char_length(whatsapp) <= 20);

-- Los admins de la banda deciden si es pública. Cada persona decide por su perfil mediante una función que exige ser mayor de edad.
grant update (is_public) on public.bands to authenticated;
grant update (whatsapp) on public.profiles to authenticated;

create or replace function public.set_profile_public(p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select age_declaration into a from public.profiles where id = (select auth.uid());
  if p_public and a is distinct from 'adult' then raise exception 'solo las personas mayores de edad pueden tener perfil público'; end if;
  update public.profiles set is_public = p_public where id = (select auth.uid());
end $$;
revoke all on function public.set_profile_public from public, anon;
grant execute on function public.set_profile_public to authenticated;

-- ───────── Qué columnas de profiles puede leer cada usuario ─────────
-- Antes cualquier compañero de banda podía leer todas (incluida la declaración de edad). Ahora solo lo que se muestra.
revoke select on public.profiles from authenticated;
grant select (id, display_name, instruments, city, bio, is_public, whatsapp, created_at) on public.profiles to authenticated;

-- ───────── Lectura pública (solo para personas con cuenta) ─────────
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select to authenticated using (is_public);

drop policy if exists bands_public_read on public.bands;
create policy bands_public_read on public.bands for select to authenticated using (is_public);

create or replace function public.band_is_public(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bands where id = b and is_public);
$$;
revoke all on function public.band_is_public from public, anon;
grant execute on function public.band_is_public to authenticated;

drop policy if exists photos_public_read on public.band_photos;
create policy photos_public_read on public.band_photos for select to authenticated using (public.band_is_public(band_id));

-- Integrantes de una banda pública: solo los que hicieron público su perfil.
create or replace function public.band_public_members(p_band uuid)
returns table (profile_id uuid, display_name text, instrument text, instruments text[], role text)
language sql stable security definer set search_path = '' as $$
  select m.profile_id, p.display_name, m.instrument, p.instruments, m.role
  from public.band_members m
  join public.profiles p on p.id = m.profile_id
  where m.band_id = p_band and p.is_public and public.band_is_public(p_band)
  order by (m.role = 'owner') desc, p.display_name;
$$;

-- Cuántas personas tiene una banda pública (sin decir quiénes).
create or replace function public.band_member_count(p_band uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.band_members where band_id = p_band and public.band_is_public(p_band);
$$;

-- Bandas públicas de una persona pública.
create or replace function public.profile_public_bands(p_profile uuid)
returns table (band_id uuid, name text, city text, genres text[], logo_path text, instrument text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.city, b.genres, b.logo_path, m.instrument
  from public.band_members m
  join public.bands b on b.id = m.band_id and b.is_public
  join public.profiles p on p.id = m.profile_id and p.is_public
  where m.profile_id = p_profile
  order by b.name;
$$;

revoke all on function public.band_public_members, public.band_member_count, public.profile_public_bands from public, anon;
grant execute on function public.band_public_members, public.band_member_count, public.profile_public_bands to authenticated;
