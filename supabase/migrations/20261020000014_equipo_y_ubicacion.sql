-- Ficha técnica de cada sala (medidas y equipo, incluido o de alquiler aparte) y ubicación del negocio en el mapa. Repetible.

-- ───────── Medidas de la sala ─────────
alter table public.venue_rooms
  add column if not exists width_m numeric(5, 1) check (width_m is null or (width_m > 0 and width_m <= 200)),
  add column if not exists length_m numeric(5, 1) check (length_m is null or (length_m > 0 and length_m <= 200)),
  add column if not exists height_m numeric(4, 1) check (height_m is null or (height_m > 0 and height_m <= 30));

-- ───────── Ubicación del negocio (para el mapa y "cómo llegar") ─────────
alter table public.venues
  add column if not exists lat numeric(9, 6) check (lat is null or lat between -90 and 90),
  add column if not exists lng numeric(9, 6) check (lng is null or lng between -180 and 180);
alter table public.venues drop constraint if exists venues_lat_lng_juntos;
alter table public.venues add constraint venues_lat_lng_juntos check ((lat is null) = (lng is null));
grant update (lat, lng) on public.venues to authenticated;

-- ───────── Equipo de cada sala ─────────
-- Cada fila es un tipo de equipo con su cantidad. Lo básico (tipo y cantidad) es obligatorio; marca, referencia, formato,
-- canales y detalles son opcionales. Si no va incluido en el precio, se ofrece en alquiler aparte (precio por hora o por sesión).
create table if not exists public.room_equipment (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  venue_id uuid not null references public.venues(id) on delete cascade,
  kind text not null check (kind in ('guitar_amp', 'bass_amp', 'drums', 'keyboard', 'mixer', 'pa', 'mics', 'guitar', 'bass', 'percussion', 'other')),
  title text check (char_length(title) <= 60),                                   -- nombre propio cuando el tipo es «otro»
  quantity int not null default 1 check (quantity between 1 and 99),
  format text check (format in ('combo', 'head_cabinet', 'analog', 'digital')),  -- amplificadores: combo o cabezote y cabina; consola: análoga o digital
  brand text check (char_length(brand) <= 60),
  model text check (char_length(model) <= 80),
  channels int check (channels between 1 and 128),                               -- consola o PA
  details text check (char_length(details) <= 300),
  included boolean not null default true,                                        -- true: incluido en el precio de la sala
  extra_price int check (extra_price between 0 and 2000000),                     -- si no está incluido: precio del alquiler (null = consultar)
  extra_unit text not null default 'hour' check (extra_unit in ('hour', 'session')),
  created_at timestamptz not null default now(),
  foreign key (room_id, venue_id) references public.venue_rooms(id, venue_id) on delete cascade
);
create index if not exists room_equipment_room_idx on public.room_equipment (room_id);
create index if not exists room_equipment_venue_idx on public.room_equipment (venue_id);

create or replace function public.room_equipment_count(r uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.room_equipment where room_id = r;
$$;
revoke all on function public.room_equipment_count from public, anon;
grant execute on function public.room_equipment_count to authenticated;

alter table public.room_equipment enable row level security;
drop policy if exists equip_read on public.room_equipment;
create policy equip_read on public.room_equipment for select to authenticated using (public.venue_visible(venue_id));
drop policy if exists equip_insert on public.room_equipment;
create policy equip_insert on public.room_equipment for insert to authenticated
  with check (public.owns_venue(venue_id) and public.room_equipment_count(room_id) < 40);
drop policy if exists equip_update on public.room_equipment;
create policy equip_update on public.room_equipment for update to authenticated
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));
drop policy if exists equip_delete on public.room_equipment;
create policy equip_delete on public.room_equipment for delete to authenticated using (public.owns_venue(venue_id));

revoke all on public.room_equipment from anon, authenticated;
grant select, delete on public.room_equipment to authenticated;
grant insert (room_id, venue_id, kind, title, quantity, format, brand, model, channels, details, included, extra_price, extra_unit) on public.room_equipment to authenticated;
grant update (kind, title, quantity, format, brand, model, channels, details, included, extra_price, extra_unit) on public.room_equipment to authenticated;
