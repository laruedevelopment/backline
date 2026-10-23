-- Quién toca cada instrumento en cada canción: [{"instrument":"Bajo","profile_id":"<uuid>"}, {"instrument":"Trompeta","guest":"Camilo"}].
-- Es informativo (se muestra y se usa en el modo escenario); un perfil que ya no está en la banda simplemente no se muestra. Repetible.
alter table public.songs add column if not exists lineup jsonb not null default '[]'::jsonb;

alter table public.songs drop constraint if exists songs_lineup_size;
alter table public.songs add constraint songs_lineup_size
  check (jsonb_typeof(lineup) = 'array' and jsonb_array_length(lineup) <= 20 and pg_column_size(lineup) < 4000);
