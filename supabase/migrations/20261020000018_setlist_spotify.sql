-- Link opcional a la playlist de Spotify de un setlist (solo es un hipervínculo; no se carga nada de Spotify hasta que se toca).
-- Repetible.
alter table public.setlists add column if not exists spotify_url text;
alter table public.setlists drop constraint if exists setlists_spotify_url_check;
alter table public.setlists add constraint setlists_spotify_url_check
  check (spotify_url is null or (char_length(spotify_url) <= 300 and spotify_url ~* '^https://([a-z0-9-]+\.)*(spotify\.com|spotify\.link)(/|$)'));
