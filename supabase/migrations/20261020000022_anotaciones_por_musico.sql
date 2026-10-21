-- Anotaciones personales por canción: cada integrante escribe lo suyo (p. ej. «Les Paul»). Toda la banda las lee desde la edición de la
-- canción; en el modo escenario cada quien ve únicamente la suya. Solo se escribe y se borra la propia. Repetible.
create unique index if not exists songs_id_band_key on public.songs (id, band_id);

create table if not exists public.song_member_notes (
  song_id uuid not null,
  band_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 500),
  updated_at timestamptz not null default now(),
  primary key (song_id, profile_id),
  foreign key (song_id, band_id) references public.songs (id, band_id) on delete cascade
);
create index if not exists song_member_notes_band_idx on public.song_member_notes (band_id);

alter table public.song_member_notes enable row level security;

drop policy if exists smn_read on public.song_member_notes;
create policy smn_read on public.song_member_notes for select to authenticated using (public.is_band_member(band_id));

drop policy if exists smn_insert on public.song_member_notes;
create policy smn_insert on public.song_member_notes for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.can_edit_band(band_id));

drop policy if exists smn_update on public.song_member_notes;
create policy smn_update on public.song_member_notes for update to authenticated
  using (profile_id = (select auth.uid()) and public.can_edit_band(band_id))
  with check (profile_id = (select auth.uid()) and public.can_edit_band(band_id));

drop policy if exists smn_delete on public.song_member_notes;
create policy smn_delete on public.song_member_notes for delete to authenticated using (profile_id = (select auth.uid()));

revoke all on public.song_member_notes from authenticated, anon;
grant select, insert, delete on public.song_member_notes to authenticated;
grant update (note, updated_at) on public.song_member_notes to authenticated;
