-- Formación por defecto de la banda («Quién toca»): se define una vez en Ajustes y se aplica a canciones o setlists; las canciones nuevas nacen con ella. Repetible.
create table if not exists public.band_defaults (
  band_id uuid primary key references public.bands(id) on delete cascade,
  lineup jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint band_defaults_lineup_check check (jsonb_typeof(lineup) = 'array' and jsonb_array_length(lineup) <= 20)
);
alter table public.band_defaults enable row level security;
drop policy if exists band_defaults_read on public.band_defaults;
create policy band_defaults_read on public.band_defaults for select to authenticated using (public.is_band_member(band_id));
drop policy if exists band_defaults_insert on public.band_defaults;
create policy band_defaults_insert on public.band_defaults for insert to authenticated with check (public.is_band_admin(band_id));
drop policy if exists band_defaults_update on public.band_defaults;
create policy band_defaults_update on public.band_defaults for update to authenticated using (public.is_band_admin(band_id)) with check (public.is_band_admin(band_id));
grant select, insert, update on public.band_defaults to authenticated;
