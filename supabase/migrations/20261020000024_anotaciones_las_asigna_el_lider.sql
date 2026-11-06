-- Anotaciones por músico: cada quien escribe la suya y quien lidera la banda (owner/admin) puede escribir, cambiar o borrar la de cualquier integrante.
-- Se guarda quién la escribió por última vez para mostrarlo cuando la puso otra persona. Repetible.
alter table public.song_member_notes add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create or replace function public.is_member_of(b uuid, p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members where band_id = b and profile_id = p);
$$;
revoke all on function public.is_member_of from public, anon;
grant execute on function public.is_member_of to authenticated;

drop policy if exists smn_insert on public.song_member_notes;
create policy smn_insert on public.song_member_notes for insert to authenticated
  with check (
    (profile_id = (select auth.uid()) and public.can_edit_band(band_id))
    or (public.is_band_admin(band_id) and public.is_member_of(band_id, profile_id))
  );

drop policy if exists smn_update on public.song_member_notes;
create policy smn_update on public.song_member_notes for update to authenticated
  using ((profile_id = (select auth.uid()) and public.can_edit_band(band_id)) or public.is_band_admin(band_id))
  with check ((profile_id = (select auth.uid()) and public.can_edit_band(band_id)) or (public.is_band_admin(band_id) and public.is_member_of(band_id, profile_id)));

drop policy if exists smn_delete on public.song_member_notes;
create policy smn_delete on public.song_member_notes for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_band_admin(band_id));

grant update (note, updated_at, updated_by) on public.song_member_notes to authenticated;
