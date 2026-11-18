-- Invitados de un setlist: nombres de personas que tocan en ese toque sin ser de la banda ni tener cuenta ([{"id":"…","name":"Camilo"}]).
-- Aparecen como opción al asignar «quién toca» cuando se edita una canción desde ese setlist. Repetible.
alter table public.setlists add column if not exists guests jsonb not null default '[]'::jsonb;
alter table public.setlists drop constraint if exists setlists_guests_check;
alter table public.setlists add constraint setlists_guests_check
  check (jsonb_typeof(guests) = 'array' and jsonb_array_length(guests) <= 20 and pg_column_size(guests) < 4000);
