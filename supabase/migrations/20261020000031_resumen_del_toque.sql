-- Resumen después de un toque o ensayo: qué salió bien, qué mejorar, para la próxima. Lo escribe quien edita la agenda; lo lee la banda. Repetible.
alter table public.events add column if not exists recap text;
alter table public.events drop constraint if exists events_recap_len;
alter table public.events add constraint events_recap_len check (recap is null or char_length(recap) <= 2000);
