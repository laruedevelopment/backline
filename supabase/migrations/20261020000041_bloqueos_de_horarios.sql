-- Bloqueos de horario hechos por el dueño (cierre del negocio, una sala en mejoras, evento privado…) y control de lo importado del calendario.
--  · room_blocks: rango de fechas y horas; room_id nulo = todo el negocio cerrado.
--  · room_busy_ignored: eventos del calendario de Google que el dueño decide ignorar (se identifican por sala + horas, así sobreviven a la sincronización).
-- Repetible.

create table if not exists public.room_blocks (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  room_id uuid references public.venue_rooms(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at and ends_at - starts_at <= interval '400 days'),
  reason text check (reason is null or char_length(reason) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists room_blocks_venue_idx on public.room_blocks (venue_id, starts_at);
create index if not exists room_blocks_room_idx on public.room_blocks (room_id, starts_at);
alter table public.room_blocks enable row level security;
drop policy if exists room_blocks_owner_read on public.room_blocks;
create policy room_blocks_owner_read on public.room_blocks for select to authenticated using (public.owns_venue(venue_id));
drop policy if exists room_blocks_owner_delete on public.room_blocks;
create policy room_blocks_owner_delete on public.room_blocks for delete to authenticated using (public.owns_venue(venue_id));
revoke all on public.room_blocks from anon, authenticated;
grant select, delete on public.room_blocks to authenticated;   -- crear solo con add_room_block

create table if not exists public.room_busy_ignored (
  room_id uuid not null references public.venue_rooms(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  primary key (room_id, starts_at, ends_at)
);
alter table public.room_busy_ignored enable row level security; -- solo funciones
revoke all on public.room_busy_ignored from anon, authenticated;

-- ¿La franja está tomada por el calendario (sin ignorar) o por un bloqueo del dueño?
create or replace function public._room_taken(p_room uuid, p_start timestamptz, p_end timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_external_busy e
    where e.room_id = p_room and e.starts_at < p_end and e.ends_at > p_start
      and not exists (select 1 from public.room_busy_ignored i where i.room_id = e.room_id and i.starts_at = e.starts_at and i.ends_at = e.ends_at)
  ) or exists (
    select 1 from public.room_blocks k join public.venue_rooms r on r.venue_id = k.venue_id
    where r.id = p_room and (k.room_id = p_room or k.room_id is null) and k.starts_at < p_end and k.ends_at > p_start
  );
$$;
revoke all on function public._room_taken from public, anon, authenticated;

create or replace function public.room_busy(p_room uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  where b.room_id = p_room and b.status = 'confirmed'
    and not (b.pay_status = 'awaiting' and b.pay_due_at < now())
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
    and not exists (select 1 from public.room_busy_ignored i where i.room_id = e.room_id and i.starts_at = e.starts_at and i.ends_at = e.ends_at)
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days'
  union all
  select k.starts_at, k.ends_at
  from public.room_blocks k
  join public.venue_rooms r on r.venue_id = k.venue_id and r.id = p_room
  join public.venues v on v.id = k.venue_id
  where (k.room_id = p_room or k.room_id is null)
    and k.starts_at < p_to and k.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days';
$$;

-- Bloquear: una sala o todo el negocio. Si ya hay reservas en ese rango avisa; con p_cancel las cancela (y avisa al cliente con el motivo).
create or replace function public.add_room_block(p_venue uuid, p_room uuid, p_start timestamptz, p_end timestamptz, p_reason text default null, p_cancel boolean default false)
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; n int; msg text;
begin
  if not public.owns_venue(p_venue) then raise exception 'solo el dueño de la sala puede bloquear horarios'; end if;
  if p_room is not null and not exists (select 1 from public.venue_rooms where id = p_room and venue_id = p_venue) then raise exception 'esa sala no es de tu negocio'; end if;
  if p_end <= p_start then raise exception 'la hora final debe ser posterior a la inicial'; end if;
  if p_end - p_start > interval '400 days' then raise exception 'el bloqueo es demasiado largo'; end if;
  if (select count(*) from public.room_blocks where venue_id = p_venue and ends_at > now()) >= 100 then raise exception 'demasiados bloqueos activos'; end if;

  select coalesce(array_agg(b.id), '{}') into ids from public.bookings b
  where b.venue_id = p_venue and (p_room is null or b.room_id = p_room) and b.status in ('requested', 'confirmed')
    and b.starts_at < p_end and b.ends_at > p_start;
  n := coalesce(array_length(ids, 1), 0);
  if n > 0 and not p_cancel then raise exception 'conflicto:%', n; end if;

  insert into public.room_blocks (venue_id, room_id, starts_at, ends_at, reason) values (p_venue, p_room, p_start, p_end, left(nullif(trim(p_reason), ''), 80));
  if n > 0 then
    msg := 'La sala no estará disponible en ese horario' || coalesce(' (' || left(nullif(trim(p_reason), ''), 80) || ')', '') || '. Tu reserva se canceló; puedes pedir otra franja.';
    update public.bookings set status = 'cancelled', response_note = msg, responded_at = now() where id = any(ids);
    delete from public.events where booking_id = any(ids);
  end if;
  return ids;
end $$;

-- Eventos importados del calendario (solo horas) para que el dueño ignore los que no son de la sala.
create or replace function public.list_external_busy(p_room uuid)
returns table (starts_at timestamptz, ends_at timestamptz, ignored boolean)
language sql stable security definer set search_path = '' as $$
  select e.starts_at, e.ends_at,
         exists (select 1 from public.room_busy_ignored i where i.room_id = e.room_id and i.starts_at = e.starts_at and i.ends_at = e.ends_at)
  from public.room_external_busy e
  join public.venue_rooms r on r.id = e.room_id
  where e.room_id = p_room and public.owns_venue(r.venue_id) and e.ends_at > now()
  order by e.starts_at limit 120;
$$;

create or replace function public.set_external_ignored(p_room uuid, p_start timestamptz, p_end timestamptz, p_ignored boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.venue_rooms r where r.id = p_room and public.owns_venue(r.venue_id)) then raise exception 'solo el dueño de la sala puede hacerlo'; end if;
  if p_ignored then
    insert into public.room_busy_ignored (room_id, starts_at, ends_at) values (p_room, p_start, p_end) on conflict do nothing;
  else
    delete from public.room_busy_ignored where room_id = p_room and starts_at = p_start and ends_at = p_end;
  end if;
end $$;
revoke all on function public.add_room_block, public.list_external_busy, public.set_external_ignored from public, anon;
grant execute on function public.add_room_block, public.list_external_busy, public.set_external_ignored to authenticated;

-- Pedir una franja: también se rechaza si el dueño la bloqueó.
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
  total int; dep int; pay boolean;
begin
  if uid is null then raise exception 'no autenticado'; end if;
  perform public.expire_unpaid_bookings();
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
     or public._room_taken(p_room, p_start, p_end) then
    raise exception 'esa franja ya está ocupada';
  end if;
  if (select count(*) from public.bookings where requested_by = uid and status in ('requested', 'confirmed') and ends_at > now()) >= 6 then
    raise exception 'tienes demasiadas solicitudes pendientes';
  end if;

  st := case when v.auto_confirm then 'confirmed' else 'requested' end;
  total := case when r.price_per_hour > 0 then round(r.price_per_hour * extract(epoch from (p_end - p_start)) / 3600.0)::int end;
  pay := v.pay_required and total is not null;
  dep := case when pay then (case when v.pay_deposit_pct is not null then round(total * v.pay_deposit_pct / 100.0)::int else total end) end;
  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, note, status, responded_at,
                               total_amount, deposit_amount, pay_status, pay_due_at)
  values (
    v.id, p_room, p_band, uid,
    coalesce((select display_name from public.profiles where id = uid), ''),
    left(nullif(trim(p_phone), ''), 20), p_start, p_end, left(nullif(trim(p_note), ''), 300), st,
    case when st = 'confirmed' then now() end,
    total, dep,
    case when pay and st = 'confirmed' then 'awaiting' else 'not_required' end,
    case when pay and st = 'confirmed' then least(now() + make_interval(hours => v.pay_hold_hours), p_start - interval '10 minutes') end
  ) returning id into new_id;

  if st = 'confirmed' then perform public.booking_to_event(new_id); end if;
  return new_id;
end $$;
