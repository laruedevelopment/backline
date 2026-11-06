-- «Busco músico»: una banda pública publica que necesita un instrumento (temporal o definitivo, con fecha y detalles) y los músicos
-- adultos responden. Solo el líder o admin de la banda publica, edita y ve las respuestas. Repetible.

create table if not exists public.band_openings (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  instrument text not null check (char_length(btrim(instrument)) between 1 and 40),
  kind text not null check (kind in ('temporary', 'permanent')),
  needed_on date,
  city text check (city is null or char_length(city) <= 60),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists band_openings_band_idx on public.band_openings (band_id);
create index if not exists band_openings_open_idx on public.band_openings (created_at desc) where status = 'open';

create table if not exists public.opening_replies (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.band_openings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (opening_id, profile_id)
);
create index if not exists opening_replies_opening_idx on public.opening_replies (opening_id);

alter table public.band_openings enable row level security;
alter table public.opening_replies enable row level security;

-- Se ven las abiertas de bandas públicas (cualquier persona con cuenta) y todas las de tu banda.
drop policy if exists bo_read on public.band_openings;
create policy bo_read on public.band_openings for select to authenticated
  using (public.is_band_member(band_id) or (status = 'open' and exists (select 1 from public.bands b where b.id = band_id and b.is_public)));
drop policy if exists bo_insert on public.band_openings;
create policy bo_insert on public.band_openings for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_band_admin(band_id));
drop policy if exists bo_update on public.band_openings;
create policy bo_update on public.band_openings for update to authenticated
  using (public.is_band_admin(band_id)) with check (public.is_band_admin(band_id));
drop policy if exists bo_delete on public.band_openings;
create policy bo_delete on public.band_openings for delete to authenticated using (public.is_band_admin(band_id));

create or replace function public.opening_band(o uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select band_id from public.band_openings where id = o;
$$;
revoke all on function public.opening_band from public, anon;
grant execute on function public.opening_band to authenticated;

-- Responde un adulto que no es de la banda, a una publicación abierta de una banda pública. Ve y borra la suya; el admin de la banda ve las de su banda.
drop policy if exists or_read on public.opening_replies;
create policy or_read on public.opening_replies for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(public.opening_band(opening_id)));
drop policy if exists or_insert on public.opening_replies;
create policy or_insert on public.opening_replies for insert to authenticated
  with check (
    profile_id = (select auth.uid()) and public.is_adult(profile_id)
    and not public.is_band_member(public.opening_band(opening_id))
    and exists (select 1 from public.band_openings o join public.bands b on b.id = o.band_id where o.id = opening_id and o.status = 'open' and b.is_public)
  );
drop policy if exists or_delete on public.opening_replies;
create policy or_delete on public.opening_replies for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(public.opening_band(opening_id)));

revoke all on public.band_openings, public.opening_replies from authenticated, anon;
grant select, insert, delete on public.band_openings, public.opening_replies to authenticated;
grant update (instrument, kind, needed_on, city, details, status) on public.band_openings to authenticated;

-- Publicaciones abiertas con el nombre de la banda (la banda es pública, así que su nombre y logo también).
create or replace function public.open_openings() returns table (
  id uuid, band_id uuid, band_name text, band_logo text, band_city text, instrument text, kind text, needed_on date, city text, details text,
  created_at timestamptz, replied boolean
) language sql stable security definer set search_path = '' as $$
  select o.id, o.band_id, b.name, b.logo_path, b.city, o.instrument, o.kind, o.needed_on, o.city, o.details, o.created_at,
         exists (select 1 from public.opening_replies r where r.opening_id = o.id and r.profile_id = (select auth.uid()))
  from public.band_openings o join public.bands b on b.id = o.band_id
  where o.status = 'open' and b.is_public and (o.needed_on is null or o.needed_on >= current_date)
  order by o.created_at desc
  limit 200;
$$;
revoke all on function public.open_openings from public, anon;
grant execute on function public.open_openings to authenticated;

-- Quién respondió (solo el admin de esa banda): nombre y datos que la persona ya expone en su perfil.
create or replace function public.opening_replies_for(p_opening uuid) returns table (
  id uuid, profile_id uuid, display_name text, avatar_path text, instruments text[], city text, message text, created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select r.id, r.profile_id, p.display_name, p.avatar_path, p.instruments, p.city, r.message, r.created_at
  from public.opening_replies r join public.profiles p on p.id = r.profile_id
  where r.opening_id = p_opening and public.is_band_admin(public.opening_band(p_opening))
  order by r.created_at;
$$;
revoke all on function public.opening_replies_for from public, anon;
grant execute on function public.opening_replies_for to authenticated;

-- Quien responde a una búsqueda puede recibir una solicitud de amistad del admin de esa banda aunque no tenga el perfil público.
create or replace function public.can_befriend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a <> b and public.is_adult(a) and public.is_adult(b) and not public.is_blocked_between(a, b)
    and (public.shares_band(a, b)
         or exists (select 1 from public.profiles where id = b and is_public)
         or exists (select 1 from public.opening_replies r join public.band_openings o on o.id = r.opening_id
                    join public.band_members m on m.band_id = o.band_id
                    where r.profile_id = b and m.profile_id = a and m.role in ('owner', 'admin')));
$$;
