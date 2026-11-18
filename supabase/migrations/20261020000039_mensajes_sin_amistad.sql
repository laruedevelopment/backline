-- Contacto dentro de Backline: se puede escribir a una persona adulta sin ser amigas cuando hay un motivo (perfil público, anuncio, sala de
-- ensayos, banda, búsqueda). El primer mensaje crea una «solicitud de mensaje»: quien la envía puede mandar hasta 3 mensajes y la otra persona
-- acepta o rechaza (o bloquea). Con amistad nada cambia. Repetible.

-- Lectura de «es adulta» sin las restricciones de la versión pública (solo la usan funciones internas).
create or replace function public._adult(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and age_declaration = 'adult');
$$;
revoke all on function public._adult from public, anon, authenticated;

create table if not exists public.dm_contacts (
  lo uuid not null references public.profiles(id) on delete cascade,
  hi uuid not null references public.profiles(id) on delete cascade,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (lo, hi),
  check (lo < hi)
);
alter table public.dm_contacts enable row level security;
revoke all on public.dm_contacts from authenticated, anon;

-- ¿Hay motivo para que `a` le escriba a `b`? (solo responde sobre quien llama)
create or replace function public.can_contact(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a = (select auth.uid()) and a <> b and public._adult(a) and public._adult(b) and not public.is_blocked_between(a, b)
    and (exists (select 1 from public.profiles p where p.id = b and p.is_public)
      or exists (select 1 from public.listings l where l.seller = b and l.status = 'active')
      or exists (select 1 from public.venues v where v.owner_id = b and v.is_published)
      or public.shares_band(a, b)
      or exists (select 1 from public.opening_replies r join public.band_openings o on o.id = r.opening_id join public.band_members m on m.band_id = o.band_id
                 where ((r.profile_id = a and m.profile_id = b) or (r.profile_id = b and m.profile_id = a)) and m.role in ('owner', 'admin')));
$$;
revoke all on function public.can_contact from public, anon;
grant execute on function public.can_contact to authenticated;

-- Puerta de los mensajes directos: amigos libre; si no, solicitud con tope de 3 mensajes hasta que respondan.
create or replace function public.dm_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a uuid := new.sender; b uuid := new.recipient; c public.dm_contacts%rowtype; n int;
begin
  if public.is_blocked_between(a, b) then raise exception 'no puedes escribirle a esta persona'; end if;
  if public.are_friends(a, b) then return new; end if;
  select * into c from public.dm_contacts where lo = least(a, b) and hi = greatest(a, b);
  if not found then
    if not public.can_contact(a, b) then raise exception 'no puedes escribirle a esta persona'; end if;
    insert into public.dm_contacts (lo, hi, initiated_by) values (least(a, b), greatest(a, b), a);
    return new;
  end if;
  if c.status = 'declined' then raise exception 'esta persona no recibe mensajes tuyos'; end if;
  if c.status = 'pending' then
    if c.initiated_by = a then
      select count(*) into n from public.direct_messages where sender = a and recipient = b;
      if n >= 3 then raise exception 'espera a que te respondan'; end if;
    else
      update public.dm_contacts set status = 'accepted' where lo = c.lo and hi = c.hi;  -- responder acepta la conversación
    end if;
  end if;
  return new;
end $$;
revoke all on function public.dm_gate from public, anon, authenticated;
drop trigger if exists direct_messages_gate on public.direct_messages;
create trigger direct_messages_gate before insert on public.direct_messages for each row execute function public.dm_gate();

-- Es volátil a propósito: tiene que ver la solicitud que el disparador acaba de crear en esta misma instrucción.
create or replace function public.can_dm(a uuid, b uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select a = (select auth.uid()) and not public.is_blocked_between(a, b)
    and (public.are_friends(a, b) or exists (select 1 from public.dm_contacts c where c.lo = least(a, b) and c.hi = greatest(a, b) and c.status <> 'declined'));
$$;
revoke all on function public.can_dm from public, anon;
grant execute on function public.can_dm to authenticated;

drop policy if exists dm_insert on public.direct_messages;
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.can_dm(sender, recipient));

-- Responder una solicitud de mensaje.
create or replace function public.respond_dm_request(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  update public.dm_contacts set status = case when p_accept then 'accepted' else 'declined' end
  where lo = least(me, p_other) and hi = greatest(me, p_other) and initiated_by = p_other and status = 'pending';
end $$;
revoke all on function public.respond_dm_request from public, anon;
grant execute on function public.respond_dm_request to authenticated;

-- Bloquear también cierra la conversación.
create or replace function public.block_user(p uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or p is null or p = me then raise exception 'no se puede bloquear a esa persona'; end if;
  insert into public.user_blocks (blocker, blocked) values (me, p) on conflict do nothing;
  delete from public.friendships where (requester = me and addressee = p) or (requester = p and addressee = me);
  delete from public.dm_contacts where lo = least(me, p) and hi = greatest(me, p);
end $$;

-- Conversaciones con personas que no son amigas: solicitudes recibidas, enviadas y aceptadas.
create or replace function public.conversations() returns table (
  other_id uuid, display_name text, avatar_path text, instruments text[], city text, state text, unread bigint, last_at timestamptz, last_body text
) language sql stable security definer set search_path = '' as $$
  select o.id, o.display_name, o.avatar_path, o.instruments, o.city,
         case when c.status = 'accepted' then 'accepted' when c.initiated_by = (select auth.uid()) then 'request_out' else 'request_in' end,
         (select count(*) from public.direct_messages d where d.sender = o.id and d.recipient = (select auth.uid()) and d.read_at is null),
         (select max(d.created_at) from public.direct_messages d where (d.sender = o.id and d.recipient = (select auth.uid())) or (d.sender = (select auth.uid()) and d.recipient = o.id)),
         (select d.body from public.direct_messages d where (d.sender = o.id and d.recipient = (select auth.uid())) or (d.sender = (select auth.uid()) and d.recipient = o.id) order by d.created_at desc limit 1)
  from public.dm_contacts c
  join public.profiles o on o.id = case when c.lo = (select auth.uid()) then c.hi else c.lo end
  where ((select auth.uid()) in (c.lo, c.hi)) and c.status <> 'declined';
$$;
revoke all on function public.conversations from public, anon;
grant execute on function public.conversations to authenticated;
