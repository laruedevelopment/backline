-- Setlist con etiquetas: cada elemento es una canción (con etiquetas propias) o una etiqueta suelta entre canciones
-- («Afinar a Drop C», «Pausa», «Cambio de guitarra»…). song_ids se conserva (solo canciones, en orden) por compatibilidad.
-- items: [{"t":"s","id":"<canción>","tags":["Intro largo"]}, {"t":"l","id":"<uuid>","text":"Pausa"}]. Repetible.
alter table public.setlists add column if not exists items jsonb;
alter table public.setlists drop constraint if exists setlists_items_check;
alter table public.setlists add constraint setlists_items_check
  check (items is null or (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200 and pg_column_size(items) < 30000));
