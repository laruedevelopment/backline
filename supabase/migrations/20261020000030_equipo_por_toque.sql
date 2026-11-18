-- Lista de equipo de un evento (toque o ensayo): qué hay que llevar, quién lo lleva y si ya está listo.
-- Lee toda la banda; escriben integrantes y admins. Repetible.
create unique index if not exists events_id_band_key on public.events (id, band_id);

create table if not exists public.event_gear (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  band_id uuid not null,
  item text not null check (char_length(btrim(item)) between 1 and 60),
  assigned_to uuid references public.profiles(id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (event_id, band_id) references public.events (id, band_id) on delete cascade
);
create index if not exists event_gear_event_idx on public.event_gear (event_id);
create index if not exists event_gear_band_idx on public.event_gear (band_id);

alter table public.event_gear enable row level security;

drop policy if exists eg_read on public.event_gear;
create policy eg_read on public.event_gear for select to authenticated using (public.is_band_member(band_id));
drop policy if exists eg_insert on public.event_gear;
create policy eg_insert on public.event_gear for insert to authenticated
  with check (public.can_edit_band(band_id) and (assigned_to is null or public.is_member_of(band_id, assigned_to)));
drop policy if exists eg_update on public.event_gear;
create policy eg_update on public.event_gear for update to authenticated
  using (public.can_edit_band(band_id))
  with check (public.can_edit_band(band_id) and (assigned_to is null or public.is_member_of(band_id, assigned_to)));
drop policy if exists eg_delete on public.event_gear;
create policy eg_delete on public.event_gear for delete to authenticated using (public.can_edit_band(band_id));

revoke all on public.event_gear from authenticated, anon;
grant select, insert, delete on public.event_gear to authenticated;
grant update (item, assigned_to, done) on public.event_gear to authenticated;

-- Tope de 60 elementos por evento.
create or replace function public.limit_event_gear() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.event_gear where event_id = new.event_id) >= 60 then
    raise exception 'la lista de equipo ya tiene 60 elementos' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.limit_event_gear from public, anon, authenticated;
drop trigger if exists event_gear_limit on public.event_gear;
create trigger event_gear_limit before insert on public.event_gear for each row execute function public.limit_event_gear();
