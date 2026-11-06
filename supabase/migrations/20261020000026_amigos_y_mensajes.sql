-- Amigos, bloqueos y mensajes directos. Por ahora solo entre personas que declararon ser mayores de edad.
-- Una solicitud de amistad se envía a quien tiene el perfil público o comparte banda; solo entre amigos se puede escribir.
-- Quien bloquea deja de poder recibir solicitudes y mensajes de esa persona. Repetible.

create or replace function public.is_adult(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and age_declaration = 'adult');
$$;

create table if not exists public.user_blocks (
  blocker uuid not null references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_key on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

create or replace function public.shares_band(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.band_members x join public.band_members y on x.band_id = y.band_id
    where x.profile_id = a and y.profile_id = b);
$$;

create or replace function public.can_befriend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a <> b and public.is_adult(a) and public.is_adult(b) and not public.is_blocked_between(a, b)
    and (public.shares_band(a, b) or exists (select 1 from public.profiles where id = b and is_public));
$$;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);
create index if not exists direct_messages_pair_idx on public.direct_messages (sender, recipient, created_at desc);
create index if not exists direct_messages_inbox_idx on public.direct_messages (recipient, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists blocks_own on public.user_blocks;
create policy blocks_own on public.user_blocks for all to authenticated
  using (blocker = (select auth.uid())) with check (blocker = (select auth.uid()));

drop policy if exists fr_read on public.friendships;
create policy fr_read on public.friendships for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));
drop policy if exists fr_insert on public.friendships;
create policy fr_insert on public.friendships for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending' and public.can_befriend(requester, addressee));
drop policy if exists fr_update on public.friendships;
create policy fr_update on public.friendships for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted' and not public.is_blocked_between(requester, addressee));
drop policy if exists fr_delete on public.friendships;
create policy fr_delete on public.friendships for delete to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));

drop policy if exists dm_read on public.direct_messages;
create policy dm_read on public.direct_messages for select to authenticated
  using (sender = (select auth.uid()) or recipient = (select auth.uid()));
drop policy if exists dm_insert on public.direct_messages;
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.are_friends(sender, recipient)
    and not public.is_blocked_between(sender, recipient) and public.is_adult(sender) and public.is_adult(recipient));
drop policy if exists dm_update on public.direct_messages;
create policy dm_update on public.direct_messages for update to authenticated
  using (recipient = (select auth.uid())) with check (recipient = (select auth.uid()));
drop policy if exists dm_delete on public.direct_messages;
create policy dm_delete on public.direct_messages for delete to authenticated using (sender = (select auth.uid()));

revoke all on public.user_blocks, public.friendships, public.direct_messages from authenticated, anon;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update (status, responded_at) on public.friendships to authenticated;
grant select, insert, delete on public.direct_messages to authenticated;
grant update (read_at) on public.direct_messages to authenticated;

revoke all on function public.is_adult, public.is_blocked_between, public.are_friends, public.shares_band, public.can_befriend from public, anon;
grant execute on function public.is_adult, public.is_blocked_between, public.are_friends, public.shares_band, public.can_befriend to authenticated;

-- Bloquear: guarda el bloqueo y deshace la amistad o la solicitud.
create or replace function public.block_user(p uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or p is null or p = me then raise exception 'no se puede bloquear a esa persona'; end if;
  insert into public.user_blocks (blocker, blocked) values (me, p) on conflict do nothing;
  delete from public.friendships where (requester = me and addressee = p) or (requester = p and addressee = me);
end $$;
revoke all on function public.block_user from public, anon;
grant execute on function public.block_user to authenticated;

-- Panorama de amistades: amigos y solicitudes con nombre y foto (quien aún no es amigo no puede leer el perfil completo).
create or replace function public.friends_overview() returns table (
  friendship_id uuid, other_id uuid, display_name text, avatar_path text, instruments text[], city text,
  status text, direction text, unread bigint, last_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select f.id,
         o.id,
         o.display_name,
         o.avatar_path,
         o.instruments,
         o.city,
         f.status,
         case when f.status = 'accepted' then 'friend' when f.requester = (select auth.uid()) then 'out' else 'in' end,
         (select count(*) from public.direct_messages d where d.sender = o.id and d.recipient = (select auth.uid()) and d.read_at is null),
         (select max(d.created_at) from public.direct_messages d
            where (d.sender = o.id and d.recipient = (select auth.uid())) or (d.sender = (select auth.uid()) and d.recipient = o.id))
  from public.friendships f
  join public.profiles o on o.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  where f.requester = (select auth.uid()) or f.addressee = (select auth.uid());
$$;
revoke all on function public.friends_overview from public, anon;
grant execute on function public.friends_overview to authenticated;

-- Frena ráfagas de mensajes directos (máx. 20 por minuto por persona).
create or replace function public.limit_dm_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from public.direct_messages where sender = new.sender and created_at > now() - interval '1 minute';
  if n >= 20 then raise exception 'demasiados mensajes seguidos: espera un momento' using errcode = 'P0001'; end if;
  return new;
end $$;
revoke all on function public.limit_dm_rate from public, anon, authenticated;
drop trigger if exists direct_messages_rate on public.direct_messages;
create trigger direct_messages_rate before insert on public.direct_messages for each row execute function public.limit_dm_rate();

-- Tiempo real: Realtime solo entrega las filas que esa persona puede leer.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['direct_messages', 'friendships'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
