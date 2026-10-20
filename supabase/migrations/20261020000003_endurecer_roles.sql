-- Endurecimiento tras auditoría de seguridad (daniela-seguridad, 2026-10-20).
-- Requiere haber aplicado antes la 0001 y la 0002.

-- 1. El owner no puede ser degradado ni expulsado; solo se cambian rol e instrumento.
drop policy members_leave on public.band_members;
drop policy members_role on public.band_members;
create policy members_leave on public.band_members for delete to authenticated
  using (role <> 'owner' and (profile_id = (select auth.uid()) or public.is_band_admin(band_id)));
create policy members_role on public.band_members for update to authenticated
  using (role <> 'owner' and public.is_band_admin(band_id))
  with check (role <> 'owner' and public.is_band_admin(band_id));
revoke update on public.band_members from authenticated;
grant update (role, instrument) on public.band_members to authenticated;

-- 2. Los invitados (guest) solo leen; owner/admin/member escriben.
create function public.can_edit_band(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members
    where band_id = b and profile_id = (select auth.uid()) and role in ('owner', 'admin', 'member'));
$$;
revoke all on function public.can_edit_band from public, anon;
grant execute on function public.can_edit_band to authenticated;

drop policy songs_all on public.songs;
create policy songs_read on public.songs for select to authenticated using (public.is_band_member(band_id));
create policy songs_write on public.songs for all to authenticated
  using (public.can_edit_band(band_id)) with check (public.can_edit_band(band_id));

drop policy setlists_all on public.setlists;
create policy setlists_read on public.setlists for select to authenticated using (public.is_band_member(band_id));
create policy setlists_write on public.setlists for all to authenticated
  using (public.can_edit_band(band_id)) with check (public.can_edit_band(band_id));

-- 3. Funciones: nada para anon / public.
revoke all on function public.handle_new_user, public.is_band_member, public.is_band_admin from public, anon;

-- 4. Invitaciones: el admin no elige el código ni el vencimiento; código más largo (96 bits).
alter table public.band_invites alter column code set default encode(gen_random_bytes(12), 'hex');
alter table public.band_invites alter column created_by set default auth.uid();
revoke insert on public.band_invites from authenticated;
grant insert (band_id, role, created_by) on public.band_invites to authenticated;

-- 5. Solo columnas editables por el usuario.
revoke update on public.profiles, public.bands from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, city, genres) on public.bands to authenticated;

-- 6. Tope de tamaño en los jsonb de canciones.
alter table public.songs add constraint songs_jsonb_size
  check (pg_column_size(tunings) < 4000 and pg_column_size(key_changes) < 4000 and pg_column_size(links) < 1000);
