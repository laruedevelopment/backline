-- Fase 1 · setlists: nombre + lista ordenada de canciones (song_ids conserva el orden).
-- Los ids que apunten a canciones borradas se ignoran al leer.

create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  song_ids uuid[] not null default '{}' check (cardinality(song_ids) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.setlists (band_id);

alter table public.setlists enable row level security;

create policy setlists_all on public.setlists for all to authenticated
  using (public.is_band_member(band_id)) with check (public.is_band_member(band_id));

grant select, insert, update, delete on public.setlists to authenticated;
