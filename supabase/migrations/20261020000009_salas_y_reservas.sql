-- Fase 3 · Salas de ensayo y reservas.
-- Una persona publica su sala (con una o varias salitas, horarios, fotos y precios); las bandas piden una franja y
-- el dueño confirma o rechaza. Una franja confirmada no se puede solapar en la misma salita (restricción en la base).
-- Todo se escribe por funciones (RPC) con validaciones; las tablas de reservas no aceptan escritura directa.
-- Supuesto: las salas están en Colombia (America/Bogota, sin horario de verano). Repetible.

create extension if not exists btree_gist;

-- ───────── Salas (negocios) ─────────
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'rehearsal_room' check (kind in ('rehearsal_room', 'studio', 'venue')),
  name text not null check (char_length(name) between 1 and 80),
  city text not null default '' check (char_length(city) <= 80),
  address text not null default '' check (char_length(address) <= 160),
  description text check (char_length(description) <= 1000),
  amenities text[] not null default '{}' check (cardinality(amenities) <= 20),
  whatsapp text check (char_length(whatsapp) <= 20),
  links jsonb not null default '{}' check (pg_column_size(links) < 1500),
  -- Reservar en un sistema externo (p. ej. Slothy): solo https.
  booking_url text check (booking_url is null or (booking_url ~ '^https://' and char_length(booking_url) <= 300)),
  logo_path text check (logo_path is null or logo_path like id::text || '/%'),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venues_published_city_idx on public.venues (is_published, city);
create index if not exists venues_owner_idx on public.venues (owner_id);

create table if not exists public.venue_rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  capacity int not null default 6 check (capacity between 1 and 60),
  price_per_hour int not null default 0 check (price_per_hour between 0 and 2000000),
  description text check (char_length(description) <= 300),
  created_at timestamptz not null default now(),
  unique (id, venue_id)
);
create index if not exists venue_rooms_venue_idx on public.venue_rooms (venue_id);

-- Horario semanal: weekday 0 = domingo … 6 = sábado (igual que getDay() de JavaScript). Sin fila = cerrado.
create table if not exists public.venue_hours (
  venue_id uuid not null references public.venues(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  primary key (venue_id, weekday),
  check (closes > opens)
);

create table if not exists public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  path text not null check (path like venue_id::text || '/photos/%'),
  created_at timestamptz not null default now()
);
create index if not exists venue_photos_venue_idx on public.venue_photos (venue_id, created_at desc);

-- ───────── Reservas ─────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  room_id uuid not null,
  band_id uuid references public.bands(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  contact_name text not null default '' check (char_length(contact_name) <= 60),
  contact_phone text check (char_length(contact_phone) <= 20),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'rejected', 'cancelled')),
  note text check (char_length(note) <= 300),
  response_note text check (char_length(response_note) <= 300),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  foreign key (room_id, venue_id) references public.venue_rooms(id, venue_id) on delete cascade,
  check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours'),
  -- Dos reservas confirmadas no pueden solaparse en la misma salita.
  constraint bookings_sin_solape exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'confirmed')
);
create index if not exists bookings_venue_idx on public.bookings (venue_id, starts_at);
create index if not exists bookings_requester_idx on public.bookings (requested_by, starts_at);
create index if not exists bookings_band_idx on public.bookings (band_id);

-- Una reserva confirmada con banda crea el ensayo en su agenda.
alter table public.events add column if not exists booking_id uuid unique references public.bookings(id) on delete set null;

-- ───────── Ayudantes (security definer: evitan recursión de políticas) ─────────
create or replace function public.owns_venue(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.venues where id = v and owner_id = (select auth.uid()));
$$;

create or replace function public.venue_visible(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.venues where id = v and (is_published or owner_id = (select auth.uid())));
$$;

create or replace function public.venue_photo_count(v uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.venue_photos where venue_id = v;
$$;

create or replace function public.venue_count(u uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.venues where owner_id = u;
$$;

-- Franjas ocupadas de una salita (solo confirmadas; sin datos de quién reservó).
create or replace function public.room_busy(p_room uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  where b.room_id = p_room and b.status = 'confirmed'
    and b.starts_at < p_to and b.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days';
$$;

-- ───────── Funciones de reserva ─────────
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

  -- Debe caer dentro del horario de la sala (hora de Colombia).
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
  if (select count(*) from public.bookings where requested_by = uid and status = 'requested' and ends_at > now()) >= 6 then
    raise exception 'tienes demasiadas solicitudes pendientes';
  end if;

  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, note)
  values (
    v.id, p_room, p_band, uid,
    coalesce((select display_name from public.profiles where id = uid), ''),
    left(nullif(trim(p_phone), ''), 20), p_start, p_end, left(nullif(trim(p_note), ''), 300)
  ) returning id into new_id;
  return new_id;
end $$;

create or replace function public.respond_booking(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v public.venues;
  rn text;
begin
  if p_status not in ('confirmed', 'rejected') then raise exception 'respuesta inválida'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'requested' then raise exception 'la solicitud ya no está pendiente'; end if;
  if not public.owns_venue(b.venue_id) then raise exception 'solo el dueño de la sala puede responder'; end if;

  -- Si se confirma y otra confirmada se solapa, la restricción de exclusión lanza el error.
  update public.bookings set status = p_status, response_note = left(nullif(trim(p_note), ''), 300), responded_at = now() where id = p_id;

  if p_status = 'confirmed' and b.band_id is not null then
    select * into v from public.venues where id = b.venue_id;
    select name into rn from public.venue_rooms where id = b.room_id;
    insert into public.events (band_id, kind, title, place, starts_at, notes, created_by, booking_id)
    values (b.band_id, 'rehearsal', left('Ensayo en ' || v.name || ' · ' || rn, 100), left(v.name || coalesce(', ' || nullif(v.address, ''), ''), 120),
            b.starts_at, b.note, b.requested_by, b.id)
    on conflict (booking_id) do nothing;
  end if;
end $$;

create or replace function public.cancel_booking(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status not in ('requested', 'confirmed') then raise exception 'esa reserva ya no se puede cancelar'; end if;
  if not (b.requested_by = (select auth.uid()) or public.owns_venue(b.venue_id)
          or (b.band_id is not null and public.can_edit_band(b.band_id))) then
    raise exception 'no puedes cancelar esta reserva';
  end if;
  update public.bookings set status = 'cancelled', responded_at = now() where id = p_id;
  delete from public.events where booking_id = p_id;
end $$;

revoke all on function public.owns_venue, public.venue_visible, public.venue_photo_count, public.venue_count,
  public.room_busy, public.request_booking, public.respond_booking, public.cancel_booking from public, anon;
grant execute on function public.owns_venue, public.venue_visible, public.venue_photo_count, public.venue_count,
  public.room_busy, public.request_booking, public.respond_booking, public.cancel_booking to authenticated;

-- ───────── RLS ─────────
alter table public.venues enable row level security;
alter table public.venue_rooms enable row level security;
alter table public.venue_hours enable row level security;
alter table public.venue_photos enable row level security;
alter table public.bookings enable row level security;

drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select to authenticated using (is_published or owner_id = (select auth.uid()));
drop policy if exists venues_insert on public.venues;
create policy venues_insert on public.venues for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.venue_count(owner_id) < 3);
drop policy if exists venues_update on public.venues;
create policy venues_update on public.venues for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists venues_delete on public.venues;
create policy venues_delete on public.venues for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists rooms_read on public.venue_rooms;
create policy rooms_read on public.venue_rooms for select to authenticated using (public.venue_visible(venue_id));
drop policy if exists rooms_write on public.venue_rooms;
create policy rooms_write on public.venue_rooms for all to authenticated
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

drop policy if exists hours_read on public.venue_hours;
create policy hours_read on public.venue_hours for select to authenticated using (public.venue_visible(venue_id));
drop policy if exists hours_write on public.venue_hours;
create policy hours_write on public.venue_hours for all to authenticated
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

drop policy if exists vphotos_read on public.venue_photos;
create policy vphotos_read on public.venue_photos for select to authenticated using (public.venue_visible(venue_id));
drop policy if exists vphotos_insert on public.venue_photos;
create policy vphotos_insert on public.venue_photos for insert to authenticated
  with check (public.owns_venue(venue_id) and public.venue_photo_count(venue_id) < 12);
drop policy if exists vphotos_delete on public.venue_photos;
create policy vphotos_delete on public.venue_photos for delete to authenticated using (public.owns_venue(venue_id));

-- Reservas: las ve quien las pidió, la banda y el dueño de la sala. Escribir solo por las funciones de arriba.
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated
  using (requested_by = (select auth.uid()) or public.owns_venue(venue_id)
         or (band_id is not null and public.is_band_member(band_id)));

-- ───────── Permisos ─────────
-- Partimos de cero: sin importar los privilegios por defecto del proyecto, solo queda lo que se otorga abajo.
revoke all on public.venues, public.venue_rooms, public.venue_hours, public.venue_photos, public.bookings from anon, authenticated;
grant select on public.venues, public.venue_rooms, public.venue_hours, public.venue_photos, public.bookings to authenticated;
grant insert (kind, name, city, address, description, amenities, whatsapp, links, booking_url) on public.venues to authenticated;
grant update (kind, name, city, address, description, amenities, whatsapp, links, booking_url, logo_path, is_published) on public.venues to authenticated;
grant delete on public.venues to authenticated;
grant insert, update, delete on public.venue_rooms, public.venue_hours to authenticated;
grant insert, delete on public.venue_photos to authenticated;
revoke truncate, references, trigger on public.venues, public.venue_rooms, public.venue_hours, public.venue_photos, public.bookings from anon, authenticated;

-- ───────── Archivos de las salas ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-media', 'venue-media', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists venue_media_insert on storage.objects;
create policy venue_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-media' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.owns_venue(((storage.foldername(name))[1])::uuid));
drop policy if exists venue_media_delete on storage.objects;
create policy venue_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'venue-media' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.owns_venue(((storage.foldername(name))[1])::uuid));
drop policy if exists venue_media_list on storage.objects;
create policy venue_media_list on storage.objects for select to authenticated
  using (bucket_id = 'venue-media' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.owns_venue(((storage.foldername(name))[1])::uuid));

-- ───────── Borrar cuenta: también se anonimizan los datos de contacto en reservas ─────────
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.band_members m
             where m.profile_id = uid and m.role = 'owner'
               and exists (select 1 from public.band_members o where o.band_id = m.band_id and o.profile_id <> uid)) then
    raise exception 'traspasa tus bandas antes de borrar la cuenta';
  end if;
  update public.bookings set contact_name = '', contact_phone = null, note = null where requested_by = uid;
  delete from public.bands where id in (select band_id from public.band_members where profile_id = uid and role = 'owner');
  delete from auth.users where id = uid; -- también borra sus salas (cascada) y deja requested_by en null
end $$;
