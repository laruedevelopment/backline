-- Confirmación automática: si la sala la activa, una solicitud válida (franja libre, dentro del horario) queda
-- confirmada al instante y el ensayo aparece solo en la agenda de la banda. El dueño puede cancelar cuando quiera.
-- También habilita actualizaciones en vivo (Realtime) de las reservas. Repetible.

alter table public.venues add column if not exists auto_confirm boolean not null default false;
grant update (auto_confirm) on public.venues to authenticated;

-- Crea el ensayo en la agenda de la banda para una reserva confirmada (si tiene banda).
create or replace function public.booking_to_event(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v public.venues;
  rn text;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'confirmed' or b.band_id is null then return; end if;
  select * into v from public.venues where id = b.venue_id;
  select name into rn from public.venue_rooms where id = b.room_id;
  insert into public.events (band_id, kind, title, place, starts_at, notes, created_by, booking_id)
  values (b.band_id, 'rehearsal', left('Ensayo en ' || v.name || ' · ' || rn, 100),
          left(v.name || coalesce(', ' || nullif(v.address, ''), ''), 120), b.starts_at, b.note, b.requested_by, b.id)
  on conflict (booking_id) do nothing;
end $$;
revoke all on function public.booking_to_event from public, anon, authenticated;

create or replace function public.respond_booking(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  if p_status not in ('confirmed', 'rejected') then raise exception 'respuesta inválida'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'requested' then raise exception 'la solicitud ya no está pendiente'; end if;
  if not public.owns_venue(b.venue_id) then raise exception 'solo el dueño de la sala puede responder'; end if;
  -- Si se confirma y otra confirmada se solapa, la restricción de exclusión lanza el error.
  update public.bookings set status = p_status, response_note = left(nullif(trim(p_note), ''), 300), responded_at = now() where id = p_id;
  if p_status = 'confirmed' then perform public.booking_to_event(p_id); end if;
end $$;

create or replace function public.request_booking(
  p_room uuid, p_start timestamptz, p_end timestamptz,
  p_band uuid default null, p_note text default null, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  r public.venue_rooms;
  v public.venues;
  ls timestamp; le timestamp;
  h public.venue_hours;
  new_id uuid;
  st text;
begin
  if uid is null then raise exception 'no autenticado'; end if;
  select * into r from public.venue_rooms where id = p_room;
  if not found then raise exception 'sala no disponible'; end if;
  select * into v from public.venues where id = r.venue_id and is_published;
  if not found then raise exception 'sala no disponible'; end if;
  if v.owner_id = uid then raise exception 'no puedes reservar tu propia sala desde aquí'; end if;

  if p_start < now() + interval '1 hour' then raise exception 'la franja debe empezar con al menos una hora de anticipación'; end if;
  if p_start > now() + interval '120 days' then raise exception 'solo se puede reservar con hasta 120 días de anticipación'; end if;
  if p_end - p_start < interval '30 minutes' or p_end - p_start > interval '8 hours' then raise exception 'la duración debe estar entre 30 minutos y 8 horas'; end if;

  if p_band is not null and not public.can_edit_band(p_band) then raise exception 'no puedes reservar a nombre de esa banda'; end if;

  ls := p_start at time zone 'America/Bogota';
  le := p_end at time zone 'America/Bogota';
  if ls::date <> le::date then raise exception 'la reserva debe terminar el mismo día'; end if;
  select * into h from public.venue_hours where venue_id = v.id and weekday = extract(dow from ls)::int;
  if not found then raise exception 'la sala está cerrada ese día'; end if;
  if ls::time < h.opens or le::time > h.closes then raise exception 'fuera del horario de la sala'; end if;

  if exists (select 1 from public.bookings where room_id = p_room and status = 'confirmed'
             and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end)) then
    raise exception 'esa franja ya está ocupada';
  end if;
  -- Tope de reservas activas por persona (pendientes o confirmadas a futuro): evita acaparar la sala.
  if (select count(*) from public.bookings where requested_by = uid and status in ('requested', 'confirmed') and ends_at > now()) >= 6 then
    raise exception 'tienes demasiadas solicitudes pendientes';
  end if;

  st := case when v.auto_confirm then 'confirmed' else 'requested' end;
  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, note, status, responded_at)
  values (
    v.id, p_room, p_band, uid,
    coalesce((select display_name from public.profiles where id = uid), ''),
    left(nullif(trim(p_phone), ''), 20), p_start, p_end, left(nullif(trim(p_note), ''), 300), st,
    case when st = 'confirmed' then now() end
  ) returning id into new_id;

  if st = 'confirmed' then perform public.booking_to_event(new_id); end if;
  return new_id;
end $$;

revoke all on function public.respond_booking, public.request_booking from public, anon;
grant execute on function public.respond_booking, public.request_booking to authenticated;

-- Actualizaciones en vivo: quien tiene permiso de leer una reserva recibe sus cambios al instante.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
