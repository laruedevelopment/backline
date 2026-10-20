-- Fase 1 · base: perfiles, bandas, miembros, invitaciones y repertorio.
-- Aplicada en el proyecto `backline` el 2026-10-20 (SQL Editor). Pendiente: revisión de `daniela-seguridad`.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table public.bands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  city text check (char_length(city) <= 80),
  genres text[] not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.band_members (
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  instrument text check (char_length(instrument) <= 40),
  created_at timestamptz not null default now(),
  primary key (band_id, profile_id)
);
create index on public.band_members (profile_id);

create table public.band_invites (
  code text primary key default encode(gen_random_bytes(6), 'hex'),
  band_id uuid not null references public.bands(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'guest')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid not null references auth.users(id)
);
create index on public.band_invites (band_id);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 120),
  key text not null default '' check (char_length(key) <= 6),
  bpm int not null default 100 check (bpm between 30 and 300),
  minutes int not null default 4 check (minutes between 1 and 30),
  status text not null default 'learning' check (status in ('ready', 'learning', 'paused')),
  tunings jsonb not null default '[]',      -- [{instrument, tuning, capo?}]
  key_changes jsonb not null default '[]',  -- [{section, from, to}]
  guest text check (char_length(guest) <= 80),
  links jsonb not null default '{}',        -- {youtube?, spotify?}
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.songs (band_id);

-- Perfil automático al registrarse.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'name', 60), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ayudantes para RLS (security definer evita recursión de políticas).
create function public.is_band_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members where band_id = b and profile_id = (select auth.uid()));
$$;
create function public.is_band_admin(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members
    where band_id = b and profile_id = (select auth.uid()) and role in ('owner', 'admin'));
$$;

-- Crear banda (la deja como owner) y unirse con código.
create function public.create_band(p_name text, p_city text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  insert into public.bands (name, city, created_by) values (p_name, p_city, (select auth.uid())) returning id into new_id;
  insert into public.band_members (band_id, profile_id, role) values (new_id, (select auth.uid()), 'owner');
  return new_id;
end $$;

create function public.join_band(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.band_invites;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select * into inv from public.band_invites where code = p_code and expires_at > now();
  if not found then raise exception 'código inválido o vencido'; end if;
  insert into public.band_members (band_id, profile_id, role)
  values (inv.band_id, (select auth.uid()), inv.role) on conflict do nothing;
  return inv.band_id;
end $$;

revoke all on function public.create_band, public.join_band from public, anon;
grant execute on function public.create_band, public.join_band to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.bands enable row level security;
alter table public.band_members enable row level security;
alter table public.band_invites enable row level security;
alter table public.songs enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid())
    or exists (select 1 from public.band_members a join public.band_members b on a.band_id = b.band_id
               where a.profile_id = (select auth.uid()) and b.profile_id = profiles.id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy bands_read on public.bands for select to authenticated using (public.is_band_member(id));
create policy bands_update on public.bands for update to authenticated
  using (public.is_band_admin(id)) with check (public.is_band_admin(id));
create policy bands_delete on public.bands for delete to authenticated
  using (exists (select 1 from public.band_members where band_id = id and profile_id = (select auth.uid()) and role = 'owner'));

create policy members_read on public.band_members for select to authenticated using (public.is_band_member(band_id));
create policy members_leave on public.band_members for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(band_id));
create policy members_role on public.band_members for update to authenticated
  using (public.is_band_admin(band_id)) with check (public.is_band_admin(band_id) and role <> 'owner');

create policy invites_admin on public.band_invites for all to authenticated
  using (public.is_band_admin(band_id)) with check (public.is_band_admin(band_id) and created_by = (select auth.uid()));

create policy songs_all on public.songs for all to authenticated
  using (public.is_band_member(band_id)) with check (public.is_band_member(band_id));

-- Permisos del Data API (las tablas nuevas no se exponen solas). RLS decide qué filas.
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.bands to authenticated;
grant select, update, delete on public.band_members to authenticated;
grant select, insert, update, delete on public.band_invites to authenticated;
grant select, insert, update, delete on public.songs to authenticated;
grant execute on function public.is_band_member, public.is_band_admin to authenticated;
