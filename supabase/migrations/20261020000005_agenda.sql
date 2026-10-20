-- Fase 1 · agenda: ensayos y toques con confirmación de asistencia.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  kind text not null default 'rehearsal' check (kind in ('rehearsal', 'gig', 'other')),
  title text not null check (char_length(title) between 1 and 100),
  place text not null default '' check (char_length(place) <= 120),
  starts_at timestamptz not null,
  setlist_id uuid references public.setlists(id) on delete set null,
  notes text check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.events (band_id, starts_at);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  status text not null check (status in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

-- Eventos: lo ve toda la banda (incluye invitados); lo editan owner/admin/member.
create policy events_read on public.events for select to authenticated using (public.is_band_member(band_id));
create policy events_write on public.events for all to authenticated
  using (public.can_edit_band(band_id)) with check (public.can_edit_band(band_id));

-- Asistencia: la ve la banda; cada quien responde solo por sí mismo.
-- (El subselect sobre events respeta su RLS: solo ve eventos de bandas propias.)
create policy rsvps_read on public.event_rsvps for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy rsvps_write on public.event_rsvps for all to authenticated
  using (profile_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id))
  with check (profile_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id));

grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_rsvps to authenticated;
revoke truncate, references, trigger on public.events, public.event_rsvps from anon, authenticated;
