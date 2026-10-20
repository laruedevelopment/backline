-- Letra y acordes de cada canción (los escribe la banda; se ven en el modo escenario). Solo la banda los lee: la RLS de songs ya lo garantiza.
-- Repetible.
alter table public.songs add column if not exists lyrics text check (char_length(lyrics) <= 12000);
