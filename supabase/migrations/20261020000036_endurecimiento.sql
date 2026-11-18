-- Endurecimiento tras la auditoría de seguridad (2026-11). Repetible.

-- 1) share_token: ninguna persona lo lee ni lo escribe directo (solo las funciones del líder). El permiso de tabla de `setlists`
--    anulaba el «revoke» por columna: se quita el de tabla y se concede columna por columna, sin share_token.
revoke select, insert, update on public.setlists from authenticated, anon;
grant select (id, band_id, name, song_ids, spotify_url, items, guests, created_at, updated_at) on public.setlists to authenticated;
grant insert (id, band_id, name, song_ids, spotify_url, items, guests, updated_at) on public.setlists to authenticated;
grant update (id, band_id, name, song_ids, spotify_url, items, guests, updated_at) on public.setlists to authenticated;

-- 2) Las funciones auxiliares de las políticas ya no sirven de oráculo: responden solo sobre quien llama.
create or replace function public.is_adult(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles x where x.id = p and x.age_declaration = 'adult'
      and (p = (select auth.uid()) or x.is_public
           or exists (select 1 from public.friendships f where f.status = 'accepted'
                      and ((f.requester = p and f.addressee = (select auth.uid())) or (f.addressee = p and f.requester = (select auth.uid()))))
           or exists (select 1 from public.band_members a join public.band_members b on a.band_id = b.band_id
                      where a.profile_id = p and b.profile_id = (select auth.uid())))
  );
$$;
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (a, b)
    and exists (select 1 from public.user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (a, b) and exists (select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;
create or replace function public.shares_band(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (a, b) and exists (
    select 1 from public.band_members x join public.band_members y on x.band_id = y.band_id
    where x.profile_id = a and y.profile_id = b
      and (x.guest_until is null or x.guest_until >= current_date) and (y.guest_until is null or y.guest_until >= current_date));
$$;
create or replace function public.can_befriend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a = (select auth.uid()) and a <> b and public.is_adult(a) and public.is_adult(b) and not public.is_blocked_between(a, b)
    and (public.shares_band(a, b)
         or exists (select 1 from public.profiles where id = b and is_public)
         or exists (select 1 from public.opening_replies r join public.band_openings o on o.id = r.opening_id
                    join public.band_members m on m.band_id = o.band_id
                    where r.profile_id = b and m.profile_id = a and m.role in ('owner', 'admin')));
$$;
create or replace function public.is_member_of(b uuid, p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_band_member(b) and exists (select 1 from public.band_members where band_id = b and profile_id = p);
$$;
create or replace function public.opening_band(o uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select x.band_id from public.band_openings x join public.bands bb on bb.id = x.band_id
  where x.id = o and (public.is_band_member(x.band_id) or (x.status = 'open' and bb.is_public));
$$;

-- 3) El cliente no elige la fecha, ni lo leído, ni lo avisado de lo que escribe.
create or replace function public.force_server_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  if tg_table_name = 'direct_messages' then new.read_at := null; new.notified_at := null;
  elsif tg_table_name = 'band_messages' then new.notified_at := null;
  elsif tg_table_name = 'friendships' then new.responded_at := null; new.notified_status := null;
  end if;
  return new;
end $$;
revoke all on function public.force_server_columns from public, anon, authenticated;
drop trigger if exists band_messages_force on public.band_messages;
create trigger band_messages_force before insert on public.band_messages for each row execute function public.force_server_columns();
drop trigger if exists song_comments_force on public.song_comments;
create trigger song_comments_force before insert on public.song_comments for each row execute function public.force_server_columns();
drop trigger if exists direct_messages_force on public.direct_messages;
create trigger direct_messages_force before insert on public.direct_messages for each row execute function public.force_server_columns();
drop trigger if exists friendships_force on public.friendships;
create trigger friendships_force before insert on public.friendships for each row execute function public.force_server_columns();

-- 4) Frenos: solicitudes de amistad (20 al día) y respuestas a búsquedas (20 al día).
create or replace function public.limit_daily_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if tg_table_name = 'friendships' then
    select count(*) into n from public.friendships where requester = new.requester and created_at > now() - interval '1 day';
  else
    select count(*) into n from public.opening_replies where profile_id = new.profile_id and created_at > now() - interval '1 day';
  end if;
  if n >= 20 then raise exception 'demasiados envíos hoy: intenta mañana' using errcode = 'P0001'; end if;
  return new;
end $$;
revoke all on function public.limit_daily_requests from public, anon, authenticated;
drop trigger if exists friendships_daily on public.friendships;
create trigger friendships_daily before insert on public.friendships for each row execute function public.limit_daily_requests();
drop trigger if exists opening_replies_daily on public.opening_replies;
create trigger opening_replies_daily before insert on public.opening_replies for each row execute function public.limit_daily_requests();

-- 5) Avisos push: el endpoint debe ser https de un servicio de avisos conocido (la función no hace POST a cualquier dirección).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  if p_endpoint !~* '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|mozilla\.com|windows\.com|mozaws\.net)(:[0-9]+)?/' then
    raise exception 'servicio de avisos no permitido';
  end if;
  if (select count(*) from public.push_subscriptions where user_id = (select auth.uid())) >= 10
     and not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint) then
    raise exception 'demasiados dispositivos';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;

-- 6) «Se busca»: quien lee las búsquedas no ve quién las creó.
revoke select on public.band_openings from authenticated, anon;
grant select (id, band_id, instrument, kind, needed_on, city, details, status, created_at) on public.band_openings to authenticated;

-- 7) Un invitado con plazo vencido que vuelve con un código nuevo recupera el acceso (antes quedaba «unido» sin acceso).
create or replace function public.join_band(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.band_invites;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select * into inv from public.band_invites where code = p_code and expires_at > now();
  if not found then raise exception 'código inválido o vencido'; end if;
  insert into public.band_members (band_id, profile_id, role, guest_until)
  values (inv.band_id, (select auth.uid()), inv.role, case when inv.guest_days is not null then current_date + inv.guest_days end)
  on conflict (band_id, profile_id) do update set role = excluded.role, guest_until = excluded.guest_until
    where public.band_members.guest_until is not null and public.band_members.guest_until < current_date;
  return inv.band_id;
end $$;

-- 8) El link público no se rompe por datos raros de los integrantes (id sin formato, etiquetas que no son lista).
create or replace function public.shared_setlist(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', s.name,
    'band', b.name,
    'rows', coalesce((
      select jsonb_agg(
        case when e.value ->> 't' = 'l'
          then jsonb_build_object('kind', 'label', 'text', coalesce(e.value ->> 'text', ''))
          else jsonb_build_object('kind', 'song', 'title', so.title, 'artist', so.artist, 'key', so.key, 'bpm', so.bpm, 'minutes', so.minutes,
                                  'tags', case when jsonb_typeof(e.value -> 'tags') = 'array' then e.value -> 'tags' else '[]'::jsonb end)
        end order by e.ord)
      from jsonb_array_elements(coalesce(s.items, (select jsonb_agg(jsonb_build_object('t', 's', 'id', sid)) from unnest(s.song_ids) as sid))) with ordinality as e(value, ord)
      left join public.songs so on e.value ->> 't' = 's' and so.id::text = (e.value ->> 'id') and so.band_id = s.band_id
      where e.value ->> 't' = 'l' or so.id is not null
    ), '[]'::jsonb))
  from public.setlists s join public.bands b on b.id = s.band_id
  where p_token is not null and char_length(p_token) >= 24 and s.share_token = p_token;
$$;

-- 9) Horario de sala: el día de la semana debe estar entre 0 y 6.
create or replace function public.save_venue_hours(p_venue uuid, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.venues where id = p_venue and owner_id = (select auth.uid())) then
    raise exception 'no puedes cambiar el horario de esta sala';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 7 then raise exception 'horario inválido'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where (r ->> 'weekday')::int not between 0 and 6) then raise exception 'día inválido'; end if;
  delete from public.venue_hours where venue_id = p_venue;
  insert into public.venue_hours (venue_id, weekday, opens, closes)
  select p_venue, (r ->> 'weekday')::smallint, (r ->> 'opens')::time, (r ->> 'closes')::time from jsonb_array_elements(p_rows) as r;
end $$;
