-- Notas de cada canción por instrumento ({"Batería": "entra con el hi-hat", "Bajo": "…"}): cada integrante ve la suya en el modo escenario.
-- Repetible.
alter table public.songs add column if not exists instrument_notes jsonb not null default '{}'::jsonb;

alter table public.songs drop constraint if exists songs_instrument_notes_size;
alter table public.songs add constraint songs_instrument_notes_size
  check (jsonb_typeof(instrument_notes) = 'object' and pg_column_size(instrument_notes) < 6000);
