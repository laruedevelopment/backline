-- Fase 1 · ajustes: perfil de usuario, datos públicos de la banda, traspaso de liderazgo y borrado de cuenta.

-- Perfil de usuario
alter table public.profiles
  add column instruments text[] not null default '{}' check (cardinality(instruments) <= 8),
  add column city text check (char_length(city) <= 80),
  add column bio text check (char_length(bio) <= 300);
revoke update on public.profiles from authenticated;
grant update (display_name, instruments, city, bio) on public.profiles to authenticated;

-- Datos de la banda: bio y redes ({instagram, facebook, youtube, spotify, tiktok, web}); el logo llega con Storage.
alter table public.bands
  add column bio text check (char_length(bio) <= 500),
  add column links jsonb not null default '{}' check (pg_column_size(links) < 1500);
revoke update on public.bands from authenticated;
grant update (name, city, genres, bio, links) on public.bands to authenticated;

-- Quien creó una banda o una invitación puede borrar su cuenta sin bloquear la banda.
alter table public.bands alter column created_by drop not null;
alter table public.bands drop constraint bands_created_by_fkey,
  add constraint bands_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.band_invites alter column created_by drop not null;
alter table public.band_invites drop constraint band_invites_created_by_fkey,
  add constraint band_invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

-- Traspaso de liderazgo: solo el líder, a un integrante de la banda; él queda como admin.
create function public.transfer_ownership(p_band uuid, p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.band_members
                 where band_id = p_band and profile_id = (select auth.uid()) and role = 'owner') then
    raise exception 'solo el líder puede traspasar la banda';
  end if;
  if p_to = (select auth.uid()) or not exists (select 1 from public.band_members where band_id = p_band and profile_id = p_to) then
    raise exception 'integrante inválido';
  end if;
  update public.band_members set role = 'owner' where band_id = p_band and profile_id = p_to;
  update public.band_members set role = 'admin' where band_id = p_band and profile_id = (select auth.uid());
end $$;

-- Borrar cuenta (derecho de supresión, Ley 1581): no se puede si lideras una banda con más gente.
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.band_members m
             where m.profile_id = uid and m.role = 'owner'
               and exists (select 1 from public.band_members o where o.band_id = m.band_id and o.profile_id <> uid)) then
    raise exception 'traspasa tus bandas antes de borrar la cuenta';
  end if;
  delete from public.bands where id in (select band_id from public.band_members where profile_id = uid and role = 'owner');
  delete from auth.users where id = uid;
end $$;

revoke all on function public.transfer_ownership, public.delete_account from public, anon;
grant execute on function public.transfer_ownership, public.delete_account to authenticated;

-- Cada quien cambia su propio instrumento (sin poder tocar su rol).
create function public.set_my_instrument(p_band uuid, p_instrument text) returns void
language sql security definer set search_path = '' as $$
  update public.band_members set instrument = left(nullif(trim(p_instrument), ''), 40)
  where band_id = p_band and profile_id = (select auth.uid());
$$;
revoke all on function public.set_my_instrument from public, anon;
grant execute on function public.set_my_instrument to authenticated;
