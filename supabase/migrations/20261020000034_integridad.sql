-- Integridad de datos: (1) al borrar una canción se quita de los setlists de la banda en la misma operación;
-- (2) el horario semanal de una sala se guarda entero o no se guarda (antes borraba y volvía a insertar en dos pasos). Repetible.

create or replace function public.drop_song_from_setlists() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.setlists set
    song_ids = array_remove(song_ids, old.id),
    items = case when items is null then null else coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(items) as e where not (e ->> 't' = 's' and e ->> 'id' = old.id::text)), '[]'::jsonb) end
  where band_id = old.band_id
    and (old.id = any(song_ids) or (items is not null and items @> jsonb_build_array(jsonb_build_object('t', 's', 'id', old.id::text))));
  return old;
end $$;
revoke all on function public.drop_song_from_setlists from public, anon, authenticated;
drop trigger if exists songs_drop_from_setlists on public.songs;
create trigger songs_drop_from_setlists before delete on public.songs for each row execute function public.drop_song_from_setlists();

-- Horario semanal: [{"weekday":0-6,"opens":"08:00","closes":"22:00"}]. Solo el dueño de la sala.
create or replace function public.save_venue_hours(p_venue uuid, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.venues where id = p_venue and owner_id = (select auth.uid())) then
    raise exception 'no puedes cambiar el horario de esta sala';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 7 then raise exception 'horario inválido'; end if;
  delete from public.venue_hours where venue_id = p_venue;
  insert into public.venue_hours (venue_id, weekday, opens, closes)
  select p_venue, (r ->> 'weekday')::smallint, (r ->> 'opens')::time, (r ->> 'closes')::time from jsonb_array_elements(p_rows) as r;
end $$;
revoke all on function public.save_venue_hours from public, anon;
grant execute on function public.save_venue_hours to authenticated;
