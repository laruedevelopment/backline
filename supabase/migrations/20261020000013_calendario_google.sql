-- Leer el Google Calendar de cada salita (dirección secreta iCal) para bloquear automáticamente lo que el dueño ya anotó allí.
-- Backline guarda SOLO las horas ocupadas (sin títulos ni detalles). La función `sync-calendars` hace la lectura. Repetible.

-- ───────── Dirección secreta de cada salita (solo la ve su dueño) ─────────
create table if not exists public.room_calendar_sources (
  room_id uuid primary key,
  venue_id uuid not null references public.venues(id) on delete cascade,
  -- Solo direcciones iCal de Google Calendar: evita que la función sea usada para pedir cualquier otra URL.
  url text not null check (char_length(url) <= 400 and url ~ '^https://calendar\.google\.com/calendar/ical/[^/\s]+/(private-[A-Za-z0-9]+|public)/basic\.ics$'),
  last_synced_at timestamptz,
  last_status text check (last_status in ('ok', 'error')),
  last_error text check (char_length(last_error) <= 200),
  blocks_count int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (room_id, venue_id) references public.venue_rooms(id, venue_id) on delete cascade
);
create index if not exists room_calendar_sources_venue_idx on public.room_calendar_sources (venue_id);

-- Si el dueño cambia la dirección, se descarta el estado de la sincronización anterior.
create or replace function public.reset_calendar_sync() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.url is distinct from old.url then
    new.last_synced_at := null; new.last_status := null; new.last_error := null; new.blocks_count := 0;
  end if;
  return new;
end $$;
drop trigger if exists room_calendar_sources_reset on public.room_calendar_sources;
create trigger room_calendar_sources_reset before update on public.room_calendar_sources
  for each row execute function public.reset_calendar_sync();

alter table public.room_calendar_sources enable row level security;
drop policy if exists calsrc_owner on public.room_calendar_sources;
create policy calsrc_owner on public.room_calendar_sources for all to authenticated
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

revoke all on public.room_calendar_sources from anon, authenticated;
grant select, delete on public.room_calendar_sources to authenticated;
grant insert (room_id, venue_id, url) on public.room_calendar_sources to authenticated;
grant update (url) on public.room_calendar_sources to authenticated;

-- ───────── Horas ocupadas leídas del calendario (sin detalles) ─────────
create table if not exists public.room_external_busy (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.venue_rooms(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
create index if not exists room_external_busy_room_idx on public.room_external_busy (room_id, starts_at);
alter table public.room_external_busy enable row level security; -- sin políticas ni permisos: solo funciones y la llave de servicio
revoke all on public.room_external_busy from anon, authenticated;

-- Reemplaza todas las horas ocupadas de una salita (solo la llave de servicio, desde la función de sincronización).
create or replace function public.replace_external_busy(p_room uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.room_external_busy where room_id = p_room;
  insert into public.room_external_busy (room_id, starts_at, ends_at)
  select p_room, x.starts_at, x.ends_at
  from jsonb_to_recordset(p_rows) as x(starts_at timestamptz, ends_at timestamptz)
  where x.ends_at > x.starts_at
  limit 2000;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.replace_external_busy from public, anon, authenticated;
grant execute on function public.replace_external_busy to service_role;

-- ───────── La disponibilidad ahora incluye lo que hay en el calendario ─────────
create or replace function public.room_busy(p_room uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  where b.room_id = p_room and b.status = 'confirmed'
    and b.starts_at < p_to and b.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days'
  union all
  select e.starts_at, e.ends_at
  from public.room_external_busy e
  join public.venue_rooms r on r.id = e.room_id
  join public.venues v on v.id = r.venue_id
  where e.room_id = p_room
    and e.starts_at < p_to and e.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days';
$$;
revoke all on function public.room_busy from public, anon;
grant execute on function public.room_busy to authenticated;

-- ───────── Pedir una franja: también se rechaza si el calendario de la sala la tiene ocupada ─────────
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
             and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end))
     or exists (select 1 from public.room_external_busy where room_id = p_room
                and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end)) then
    raise exception 'esa franja ya está ocupada';
  end if;
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
revoke all on function public.request_booking from public, anon;
grant execute on function public.request_booking to authenticated;

-- ───────── Permisos de la llave de servicio (las Edge Functions) ─────────
-- El proyecto no concede permisos automáticos a las tablas nuevas: se otorgan solo los que las funciones necesitan.
grant usage on schema public to service_role;
grant select, update on public.bookings to service_role;                      -- notify-booking: leer reserva y marcar el aviso
grant select on public.venues, public.venue_rooms to service_role;            -- notify-booking / sync-calendars
grant select, delete on public.push_subscriptions to service_role;            -- notify-booking: enviar y limpiar caducadas
grant select, update on public.room_calendar_sources to service_role;         -- sync-calendars: leer direcciones y anotar estado
