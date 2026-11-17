-- Invitados de un toque: una invitación puede entrar como «invitado» por unos días (por ejemplo, el músico que toca en un toque).
-- Pasado el plazo deja de ser parte de la banda sin que nadie tenga que quitarlo. Un invitado lee todo lo de la banda, confirma
-- asistencia y escribe su propia anotación en cada canción (no edita nada más). Repetible.
alter table public.band_members add column if not exists guest_until date;
alter table public.band_invites add column if not exists guest_days int;
alter table public.band_invites drop constraint if exists band_invites_guest_days_check;
alter table public.band_invites add constraint band_invites_guest_days_check check (guest_days is null or (guest_days between 1 and 90 and role = 'guest'));

-- Un invitado con plazo vencido ya no es de la banda (todas las políticas pasan por esta función).
create or replace function public.is_band_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members
    where band_id = b and profile_id = (select auth.uid()) and (guest_until is null or guest_until >= current_date));
$$;

create or replace function public.join_band(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.band_invites;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select * into inv from public.band_invites where code = p_code and expires_at > now();
  if not found then raise exception 'código inválido o vencido'; end if;
  insert into public.band_members (band_id, profile_id, role, guest_until)
  values (inv.band_id, (select auth.uid()), inv.role, case when inv.guest_days is not null then current_date + inv.guest_days end)
  on conflict do nothing;
  return inv.band_id;
end $$;
revoke all on function public.join_band from public, anon;
grant execute on function public.join_band to authenticated;

revoke insert on public.band_invites from authenticated;
grant insert (band_id, role, created_by, guest_days) on public.band_invites to authenticated;

-- El invitado escribe su propia anotación (el resto de escrituras de la banda sigue siendo solo de integrantes).
drop policy if exists smn_insert on public.song_member_notes;
create policy smn_insert on public.song_member_notes for insert to authenticated
  with check (
    (profile_id = (select auth.uid()) and public.is_band_member(band_id))
    or (public.is_band_admin(band_id) and public.is_member_of(band_id, profile_id))
  );
drop policy if exists smn_update on public.song_member_notes;
create policy smn_update on public.song_member_notes for update to authenticated
  using ((profile_id = (select auth.uid()) and public.is_band_member(band_id)) or public.is_band_admin(band_id))
  with check ((profile_id = (select auth.uid()) and public.is_band_member(band_id)) or (public.is_band_admin(band_id) and public.is_member_of(band_id, profile_id)));
