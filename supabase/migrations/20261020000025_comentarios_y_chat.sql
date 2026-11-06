-- Comentarios por canción y chat de la banda. Solo los integrantes (y el líder/admin) escriben; todos los de la banda leen.
-- Cada quien borra lo suyo; owner/admin borran lo de cualquiera (moderación). No se editan (simple y sin sorpresas). Repetible.

-- ───────── Comentarios de una canción ─────────
create table if not exists public.song_comments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null,
  band_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (song_id, band_id) references public.songs (id, band_id) on delete cascade
);
create index if not exists song_comments_song_idx on public.song_comments (song_id, created_at desc);
create index if not exists song_comments_band_idx on public.song_comments (band_id);

-- ───────── Chat de la banda ─────────
create table if not exists public.band_messages (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists band_messages_band_idx on public.band_messages (band_id, created_at desc);

-- Hasta dónde leyó cada quien (para el contador de no leídos).
create table if not exists public.band_chat_reads (
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (band_id, profile_id)
);

alter table public.song_comments enable row level security;
alter table public.band_messages enable row level security;
alter table public.band_chat_reads enable row level security;

drop policy if exists sc_read on public.song_comments;
create policy sc_read on public.song_comments for select to authenticated using (public.is_band_member(band_id));
drop policy if exists sc_insert on public.song_comments;
create policy sc_insert on public.song_comments for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.can_edit_band(band_id));
drop policy if exists sc_delete on public.song_comments;
create policy sc_delete on public.song_comments for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(band_id));

drop policy if exists bm_read on public.band_messages;
create policy bm_read on public.band_messages for select to authenticated using (public.is_band_member(band_id));
drop policy if exists bm_insert on public.band_messages;
create policy bm_insert on public.band_messages for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.can_edit_band(band_id));
drop policy if exists bm_delete on public.band_messages;
create policy bm_delete on public.band_messages for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(band_id));

drop policy if exists bcr_all on public.band_chat_reads;
create policy bcr_all on public.band_chat_reads for all to authenticated
  using (profile_id = (select auth.uid()) and public.is_band_member(band_id))
  with check (profile_id = (select auth.uid()) and public.is_band_member(band_id));

revoke all on public.song_comments, public.band_messages, public.band_chat_reads from authenticated, anon;
grant select, insert, delete on public.song_comments, public.band_messages to authenticated;
grant select, insert, update on public.band_chat_reads to authenticated;

-- Freno contra ráfagas (spam o un bucle): máx. 20 publicaciones por minuto por persona en cada tabla.
create or replace function public.limit_post_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if tg_table_name = 'band_messages' then
    select count(*) into n from public.band_messages where profile_id = new.profile_id and created_at > now() - interval '1 minute';
  else
    select count(*) into n from public.song_comments where profile_id = new.profile_id and created_at > now() - interval '1 minute';
  end if;
  if n >= 20 then raise exception 'demasiados mensajes seguidos: espera un momento' using errcode = 'P0001'; end if;
  return new;
end $$;
revoke all on function public.limit_post_rate from public, anon, authenticated;

drop trigger if exists band_messages_rate on public.band_messages;
create trigger band_messages_rate before insert on public.band_messages for each row execute function public.limit_post_rate();
drop trigger if exists song_comments_rate on public.song_comments;
create trigger song_comments_rate before insert on public.song_comments for each row execute function public.limit_post_rate();

-- Tiempo real (Realtime solo entrega las filas que esa persona puede leer).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['band_messages', 'song_comments'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
