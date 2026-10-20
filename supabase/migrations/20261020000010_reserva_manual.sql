-- El dueño de la sala registra a mano las reservas que le llegan por otros canales (WhatsApp, llamada),
-- para que la disponibilidad que ven las bandas sea la real. Repetible.

alter table public.bookings add column if not exists source text not null default 'app' check (source in ('app', 'owner'));

create or replace function public.owner_booking(
  p_room uuid, p_start timestamptz, p_end timestamptz, p_label text, p_phone text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.venue_rooms;
  new_id uuid;
begin
  select * into r from public.venue_rooms where id = p_room;
  if not found or not public.owns_venue(r.venue_id) then raise exception 'solo el dueño de la sala puede registrar reservas'; end if;
  if nullif(trim(p_label), '') is null then raise exception 'falta el nombre de quien reservó'; end if;
  if p_end - p_start < interval '30 minutes' or p_end - p_start > interval '12 hours' then raise exception 'la duración debe estar entre 30 minutos y 12 horas'; end if;
  if p_end < now() - interval '1 day' then raise exception 'esa fecha ya pasó'; end if;
  if p_start > now() + interval '365 days' then raise exception 'esa fecha está muy lejos'; end if;

  if exists (select 1 from public.bookings where room_id = p_room and status = 'confirmed'
             and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end)) then
    raise exception 'esa franja ya está ocupada';
  end if;

  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, status, note, source, responded_at)
  values (r.venue_id, p_room, null, null, left(trim(p_label), 60), left(nullif(trim(p_phone), ''), 20), p_start, p_end,
          'confirmed', left(nullif(trim(p_note), ''), 300), 'owner', now())
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.owner_booking from public, anon;
grant execute on function public.owner_booking to authenticated;
