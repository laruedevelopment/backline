-- Integrantes sin cuenta: personas de la banda que aún no usan Backline (o el bajista que va a llegar). El líder/admin las crea con un nombre
-- y un instrumento, y se pueden asignar en «Quién toca», en las anotaciones por canción y en el equipo de cada evento.
-- Cuando esa persona crea su cuenta (o llega alguien nuevo a ese puesto), reassign_member pasa de una vez todo lo que tenía asignado.
-- Repetible.

create table if not exists public.band_placeholders (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  instrument text check (instrument is null or char_length(instrument) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists band_placeholders_band_idx on public.band_placeholders (band_id);
alter table public.band_placeholders enable row level security;

drop policy if exists bph_read on public.band_placeholders;
create policy bph_read on public.band_placeholders for select to authenticated using (public.is_band_member(band_id));
drop policy if exists bph_insert on public.band_placeholders;
create policy bph_insert on public.band_placeholders for insert to authenticated with check (public.is_band_admin(band_id));
drop policy if exists bph_update on public.band_placeholders;
create policy bph_update on public.band_placeholders for update to authenticated using (public.is_band_admin(band_id)) with check (public.is_band_admin(band_id));
drop policy if exists bph_delete on public.band_placeholders;
create policy bph_delete on public.band_placeholders for delete to authenticated using (public.is_band_admin(band_id));

revoke all on public.band_placeholders from anon, authenticated;
grant select, delete on public.band_placeholders to authenticated;
grant insert (band_id, name, instrument) on public.band_placeholders to authenticated;
grant update (name, instrument) on public.band_placeholders to authenticated;

-- Tope: 12 por banda.
create or replace function public.limit_placeholders() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.band_placeholders where band_id = new.band_id) >= 12 then
    raise exception 'esta banda ya tiene demasiados integrantes sin cuenta';
  end if;
  return new;
end $$;
revoke all on function public.limit_placeholders from public, anon, authenticated;
drop trigger if exists band_placeholders_limit on public.band_placeholders;
create trigger band_placeholders_limit before insert on public.band_placeholders for each row execute function public.limit_placeholders();

-- «Integrante de la banda» ahora incluye a quienes aún no tienen cuenta (lo usan las políticas de anotaciones y de equipo).
create or replace function public.is_member_of(b uuid, p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members where band_id = b and profile_id = p)
      or exists (select 1 from public.band_placeholders where band_id = b and id = p);
$$;

-- Las anotaciones y el equipo pueden apuntar a un integrante sin cuenta: se quita la llave a profiles y la limpieza queda en un disparador.
alter table public.song_member_notes drop constraint if exists song_member_notes_profile_id_fkey;
alter table public.event_gear drop constraint if exists event_gear_assigned_to_fkey;

create or replace function public._roster_gone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.song_member_notes where profile_id = old.id;
  update public.event_gear set assigned_to = null where assigned_to = old.id;
  return old;
end $$;
revoke all on function public._roster_gone from public, anon, authenticated;
drop trigger if exists profiles_roster_gone on public.profiles;
create trigger profiles_roster_gone after delete on public.profiles for each row execute function public._roster_gone();
drop trigger if exists placeholders_roster_gone on public.band_placeholders;
create trigger placeholders_roster_gone after delete on public.band_placeholders for each row execute function public._roster_gone();

-- Pasa todo lo asignado a una persona (cuenta o sin cuenta) a otra de la misma banda: quién toca, afinaciones propias, anotaciones y equipo.
-- Si «de» es un integrante sin cuenta, se borra al terminar (ya quedó enlazado).
create or replace function public.reassign_member(p_band uuid, p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_songs int := 0; n_notes int := 0; n_gear int := 0; n int;
begin
  if not public.is_band_admin(p_band) then raise exception 'solo quien lidera la banda puede reasignar'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'elige dos personas distintas'; end if;
  if not public.is_member_of(p_band, p_from) or not public.is_member_of(p_band, p_to) then raise exception 'las dos personas deben ser de la banda'; end if;

  update public.songs s set lineup = (
    select coalesce(jsonb_agg(case when e->>'profile_id' = p_from::text then jsonb_set(e, '{profile_id}', to_jsonb(p_to::text)) else e end), '[]'::jsonb)
    from jsonb_array_elements(s.lineup) e)
  where s.band_id = p_band and exists (select 1 from jsonb_array_elements(s.lineup) e where e->>'profile_id' = p_from::text);
  get diagnostics n = row_count; n_songs := n;

  update public.songs s set tunings = (
    select coalesce(jsonb_agg(case when e->>'profileId' = p_from::text then jsonb_set(e, '{profileId}', to_jsonb(p_to::text)) else e end), '[]'::jsonb)
    from jsonb_array_elements(s.tunings) e)
  where s.band_id = p_band and exists (select 1 from jsonb_array_elements(s.tunings) e where e->>'profileId' = p_from::text);
  get diagnostics n = row_count; n_songs := greatest(n_songs, n);

  update public.song_member_notes m set profile_id = p_to
  where m.band_id = p_band and m.profile_id = p_from
    and not exists (select 1 from public.song_member_notes o where o.song_id = m.song_id and o.profile_id = p_to);
  get diagnostics n_notes = row_count;
  delete from public.song_member_notes where band_id = p_band and profile_id = p_from;

  update public.event_gear set assigned_to = p_to where band_id = p_band and assigned_to = p_from;
  get diagnostics n_gear = row_count;

  delete from public.band_placeholders where id = p_from and band_id = p_band;
  return jsonb_build_object('canciones', n_songs, 'anotaciones', n_notes, 'equipo', n_gear);
end $$;
revoke all on function public.reassign_member from public, anon;
grant execute on function public.reassign_member to authenticated;
