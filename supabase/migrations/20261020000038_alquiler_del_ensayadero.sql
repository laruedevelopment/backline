-- El alquiler de instrumentos y equipo es de todo el ensayadero (no de cada sala): las filas de alquiler pueden no tener sala.
-- Lo incluido en el precio sigue siendo de cada sala. Repetible.
alter table public.room_equipment alter column room_id drop not null;
alter table public.room_equipment drop constraint if exists room_equipment_scope_check;
alter table public.room_equipment add constraint room_equipment_scope_check check (room_id is not null or included = false);

create or replace function public.venue_rental_count(v uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.room_equipment where venue_id = v and room_id is null;
$$;
revoke all on function public.venue_rental_count from public, anon;
grant execute on function public.venue_rental_count to authenticated;

drop policy if exists equip_insert on public.room_equipment;
create policy equip_insert on public.room_equipment for insert to authenticated with check (
  public.owns_venue(venue_id)
  and ((room_id is null and included = false and public.venue_rental_count(venue_id) < 40)
    or (room_id is not null and public.room_equipment_count(room_id) < 40))
);

-- Lo que ya estaba como «alquiler aparte» en una sala pasa a ser del ensayadero (sin repetidos).
with ranked as (
  select id, row_number() over (partition by venue_id, kind, coalesce(title, ''), coalesce(brand, ''), coalesce(model, '') order by created_at desc) as rn
  from public.room_equipment where included = false and room_id is not null)
delete from public.room_equipment where id in (select id from ranked where rn > 1);
update public.room_equipment set room_id = null where included = false and room_id is not null;
