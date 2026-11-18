-- Pagos de reservas: protección al consumidor y endurecimiento (informes de Lucía y Daniela).
--  · La sala que cobra declara su nombre legal, su documento y su política de cancelación; el cliente las ve y las acepta (casilla) antes de reservar y queda registro.
--  · Las reservas con pago son solo para mayores de edad.
--  · Una reserva pagada que se cancela queda en «devolución pendiente» y la sala la marca como devuelta o sin devolución según su política.
--  · Los comprobantes se borran con la API de Storage (Supabase no permite borrar archivos con SQL): ver la función housekeeping.
--  · La subida de comprobantes queda atada a una reserva propia que espera pago.
-- Repetible.

alter table public.venues
  add column if not exists cancel_policy text check (cancel_policy is null or char_length(cancel_policy) between 10 and 500),
  add column if not exists legal_name text check (legal_name is null or char_length(legal_name) between 3 and 100),
  add column if not exists tax_id text check (tax_id is null or tax_id ~ '^[0-9A-Za-z.\- ]{5,20}$');
alter table public.venues drop constraint if exists venues_pay_info_check;
alter table public.venues add constraint venues_pay_info_check
  check (not pay_required or (cancel_policy is not null and legal_name is not null and tax_id is not null)) not valid;
grant select (cancel_policy) on public.venues to authenticated;   -- la política de cancelación es pública; el documento y el nombre legal salen por venue_legal_info
grant update (cancel_policy, legal_name, tax_id) on public.venues to authenticated;

alter table public.bookings
  add column if not exists cancel_policy_snapshot text,
  add column if not exists terms_accepted_at timestamptz;
alter table public.bookings drop constraint if exists bookings_pay_status_check;
alter table public.bookings add constraint bookings_pay_status_check
  check (pay_status in ('not_required', 'awaiting', 'proof_sent', 'paid', 'refund_due', 'refunded', 'no_refund'));

-- Datos de la sala para quien va a reservar (solo salas publicadas, o el dueño).
create or replace function public.venue_legal_info(p_venue uuid)
returns table (legal_name text, tax_id text)
language sql stable security definer set search_path = '' as $$
  select v.legal_name, v.tax_id from public.venues v
  where v.id = p_venue and (v.is_published or v.owner_id = (select auth.uid()));
$$;
revoke all on function public.venue_legal_info from public, anon;
grant execute on function public.venue_legal_info to authenticated;

drop function if exists public.my_pay_settings(uuid);
create function public.my_pay_settings(p_venue uuid)
returns table (required boolean, nequi text, breb text, link text, notes text, deposit_pct int, hold_hours int, legal_name text, tax_id text, cancel_policy text)
language sql stable security definer set search_path = '' as $$
  select v.pay_required, v.pay_nequi, v.pay_breb, v.pay_link, v.pay_notes, v.pay_deposit_pct, v.pay_hold_hours, v.legal_name, v.tax_id, v.cancel_policy
  from public.venues v where v.id = p_venue and v.owner_id = (select auth.uid());
$$;
revoke all on function public.my_pay_settings from public, anon;
grant execute on function public.my_pay_settings to authenticated;

-- Los datos de pago solo se entregan mientras la reserva espera pago (no a quien pide y cancela, ni con la reserva rechazada).
create or replace function public.booking_pay_info(p_id uuid)
returns table (nequi text, breb text, link text, notes text)
language sql stable security definer set search_path = '' as $$
  select v.pay_nequi, v.pay_breb, v.pay_link, v.pay_notes
  from public.bookings b join public.venues v on v.id = b.venue_id
  where b.id = p_id and b.status = 'confirmed' and b.pay_status in ('awaiting', 'proof_sent')
    and (b.requested_by = (select auth.uid()) or (b.band_id is not null and public.can_edit_band(b.band_id)) or v.owner_id = (select auth.uid()));
$$;

-- Pedir una franja: con cobro exige mayoría de edad y aceptación expresa; guarda la política vigente.
drop function if exists public.request_booking(uuid, timestamptz, timestamptz, uuid, text, text);
create or replace function public.request_booking(
  p_room uuid, p_start timestamptz, p_end timestamptz,
  p_band uuid default null, p_note text default null, p_phone text default null, p_accepted boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  r public.venue_rooms;
  v public.venues;
  ls timestamp; le timestamp;
  h public.venue_hours;
  new_id uuid;
  st text;
  total int; dep int; pay boolean; snap text;
begin
  if uid is null then raise exception 'no autenticado'; end if;
  perform public.expire_unpaid_bookings();
  select * into r from public.venue_rooms where id = p_room;
  if not found then raise exception 'sala no disponible'; end if;
  select * into v from public.venues where id = r.venue_id and is_published;
  if not found then raise exception 'sala no disponible'; end if;
  if v.owner_id = uid then raise exception 'no puedes reservar tu propia sala desde aquí'; end if;

  if p_start < now() + interval '1 hour' then raise exception 'la franja debe empezar con al menos una hora de anticipación'; end if;
  if p_start > now() + interval '120 days' then raise exception 'solo se puede reservar con hasta 120 días de anticipación'; end if;
  if p_end - p_start < interval '30 minutes' or p_end - p_start > interval '8 hours' then raise exception 'la duración debe estar entre 30 minutos y 8 horas'; end if;

  if p_band is not null and not public.can_edit_band(p_band) then raise exception 'no puedes reservar a nombre de esa banda'; end if;

  ls := p_start at time zone 'America/Bogota';
  le := p_end at time zone 'America/Bogota';
  if ls::date <> le::date then raise exception 'la reserva debe terminar el mismo día'; end if;
  select * into h from public.venue_hours where venue_id = v.id and weekday = extract(dow from ls)::int;
  if not found then raise exception 'la sala está cerrada ese día'; end if;
  if ls::time < h.opens or le::time > h.closes then raise exception 'fuera del horario de la sala'; end if;

  if exists (select 1 from public.bookings where room_id = p_room and status = 'confirmed'
             and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end))
     or public._room_taken(p_room, p_start, p_end) then
    raise exception 'esa franja ya está ocupada';
  end if;
  if (select count(*) from public.bookings where requested_by = uid and status in ('requested', 'confirmed') and ends_at > now()) >= 6 then
    raise exception 'tienes demasiadas solicitudes pendientes';
  end if;

  st := case when v.auto_confirm then 'confirmed' else 'requested' end;
  total := case when r.price_per_hour > 0 then round(r.price_per_hour * extract(epoch from (p_end - p_start)) / 3600.0)::int end;
  pay := v.pay_required and total is not null;
  if pay then
    if not public._adult(uid) then raise exception 'las reservas con pago son solo para mayores de edad'; end if;
    if not coalesce(p_accepted, false) then raise exception 'debes aceptar las condiciones de pago'; end if;
    snap := v.cancel_policy;
  end if;
  dep := case when pay then (case when v.pay_deposit_pct is not null then round(total * v.pay_deposit_pct / 100.0)::int else total end) end;
  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, note, status, responded_at,
                               total_amount, deposit_amount, pay_status, pay_due_at, cancel_policy_snapshot, terms_accepted_at)
  values (
    v.id, p_room, p_band, uid,
    coalesce((select display_name from public.profiles where id = uid), ''),
    left(nullif(trim(p_phone), ''), 20), p_start, p_end, left(nullif(trim(p_note), ''), 300), st,
    case when st = 'confirmed' then now() end,
    total, dep,
    case when pay and st = 'confirmed' then 'awaiting' else 'not_required' end,
    case when pay and st = 'confirmed' then least(now() + make_interval(hours => v.pay_hold_hours), p_start - interval '10 minutes') end,
    snap, case when pay then now() end
  ) returning id into new_id;

  if st = 'confirmed' then perform public.booking_to_event(new_id); end if;
  return new_id;
end $$;

revoke all on function public.request_booking from public, anon;
grant execute on function public.request_booking to authenticated;

-- Una reserva pagada que se cancela (por la banda, la sala o un bloqueo) queda en «devolución pendiente».
create or replace function public._booking_refund_flag() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and old.pay_status in ('paid', 'proof_sent') and new.pay_status = old.pay_status then
    new.pay_status := 'refund_due';
  end if;
  return new;
end $$;
drop trigger if exists bookings_refund_flag on public.bookings;
create trigger bookings_refund_flag before update on public.bookings for each row execute function public._booking_refund_flag();

-- Bloquear: mismo comportamiento, con aviso de devolución a quien ya había pagado.
create or replace function public.add_room_block(p_venue uuid, p_room uuid, p_start timestamptz, p_end timestamptz, p_reason text default null, p_cancel boolean default false)
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; n int; msg text;
begin
  if not public.owns_venue(p_venue) then raise exception 'solo el dueño de la sala puede bloquear horarios'; end if;
  if p_room is not null and not exists (select 1 from public.venue_rooms where id = p_room and venue_id = p_venue) then raise exception 'esa sala no es de tu negocio'; end if;
  if p_end <= p_start then raise exception 'la hora final debe ser posterior a la inicial'; end if;
  if p_end - p_start > interval '400 days' then raise exception 'el bloqueo es demasiado largo'; end if;
  if (select count(*) from public.room_blocks where venue_id = p_venue and ends_at > now()) >= 100 then raise exception 'demasiados bloqueos activos'; end if;

  select coalesce(array_agg(b.id), '{}') into ids from public.bookings b
  where b.venue_id = p_venue and (p_room is null or b.room_id = p_room) and b.status in ('requested', 'confirmed')
    and b.starts_at < p_end and b.ends_at > p_start;
  n := coalesce(array_length(ids, 1), 0);
  if n > 0 and not p_cancel then raise exception 'conflicto:%', n; end if;

  insert into public.room_blocks (venue_id, room_id, starts_at, ends_at, reason) values (p_venue, p_room, p_start, p_end, left(nullif(trim(p_reason), ''), 80));
  if n > 0 then
    msg := 'La sala no estará disponible en ese horario' || coalesce(' (' || left(nullif(trim(p_reason), ''), 80) || ')', '') || '. Tu reserva se canceló; puedes pedir otra franja. Si ya habías pagado, la sala debe devolverte el dinero.';
    update public.bookings set status = 'cancelled', response_note = msg, responded_at = now() where id = any(ids);
    delete from public.events where booking_id = any(ids);
  end if;
  return ids;
end $$;

-- Revisar pagos y devoluciones. Al rechazar un comprobante devuelve su ruta para que la app lo borre con la API de Storage.
drop function if exists public.review_payment(uuid, text, text);
create function public.review_payment(p_id uuid, p_action text, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v public.venues; old_path text;
begin
  if p_action not in ('paid', 'reject', 'refunded', 'no_refund') then raise exception 'acción inválida'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found then raise exception 'esta reserva ya no existe'; end if;
  if not public.owns_venue(b.venue_id) then raise exception 'solo el dueño de la sala puede revisar pagos'; end if;
  if p_action in ('refunded', 'no_refund') then
    if b.pay_status <> 'refund_due' then raise exception 'esta reserva no tiene una devolución pendiente'; end if;
    update public.bookings set pay_status = case when p_action = 'refunded' then 'refunded' else 'no_refund' end, pay_note = left(nullif(trim(p_note), ''), 200) where id = p_id;
    return null;
  end if;
  if b.status <> 'confirmed' then raise exception 'esta reserva ya no está confirmada'; end if;
  select * into v from public.venues where id = b.venue_id;
  if p_action = 'paid' then
    if b.pay_status not in ('awaiting', 'proof_sent') then raise exception 'esta reserva no espera pago'; end if;
    update public.bookings set pay_status = 'paid', pay_due_at = null, pay_note = null where id = p_id;
    return null;
  end if;
  if b.pay_status <> 'proof_sent' then raise exception 'no hay un comprobante por revisar'; end if;
  old_path := b.proof_path;
  update public.bookings set pay_status = 'awaiting', proof_path = null, proof_at = null, pay_note = left(nullif(trim(p_note), ''), 200),
    pay_due_at = least(now() + make_interval(hours => v.pay_hold_hours), b.starts_at - interval '10 minutes') where id = p_id;
  return old_path;
end $$;
revoke all on function public.review_payment from public, anon;
grant execute on function public.review_payment to authenticated;

-- Adjuntar: el archivo debe existir de verdad (no se aparta una franja con una ruta inventada).
create or replace function public.attach_payment_proof(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; uid uuid := (select auth.uid());
begin
  perform public.expire_unpaid_bookings();
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'confirmed' or b.pay_status <> 'awaiting' then raise exception 'esta reserva ya no espera un pago'; end if;
  if not (b.requested_by = uid or (b.band_id is not null and public.can_edit_band(b.band_id))) then raise exception 'no puedes adjuntar el comprobante de esta reserva'; end if;
  if p_path is null or p_path not like uid::text || '/' || p_id::text || '/%' then raise exception 'ruta de comprobante inválida'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_path) then raise exception 'ruta de comprobante inválida'; end if;
  update public.bookings set proof_path = p_path, proof_at = now(), pay_status = 'proof_sent', pay_note = null where id = p_id;
end $$;
revoke all on function public.attach_payment_proof from public, anon;
grant execute on function public.attach_payment_proof to authenticated;

-- Storage: subir solo a una reserva propia que espera pago (máx. 5 archivos por reserva); la sala también puede borrar el comprobante de sus reservas.
create or replace function public._proof_count(p_user text, p_booking text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o where o.bucket_id = 'payment-proofs' and o.name like p_user || '/' || p_booking || '/%';
$$;
revoke all on function public._proof_count from public, anon;
grant execute on function public._proof_count to authenticated;

drop policy if exists proofs_insert on storage.objects;
create policy proofs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.bookings b where b.id::text = (storage.foldername(name))[2] and b.pay_status = 'awaiting'
                and (b.requested_by = (select auth.uid()) or (b.band_id is not null and public.can_edit_band(b.band_id))))
    and public._proof_count((storage.foldername(name))[1], (storage.foldername(name))[2]) < 5
  );
drop policy if exists proofs_owner_delete on storage.objects;
create policy proofs_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.proof_visible_to_owner(name));

-- Borrar la cuenta: la app comprueba primero si se puede (antes de borrar archivos).
create or replace function public.check_delete_account() returns void
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.band_members m where m.profile_id = uid and m.role = 'owner'
             and exists (select 1 from public.band_members o where o.band_id = m.band_id and o.profile_id <> uid)) then
    raise exception 'traspasa tus bandas antes de borrar la cuenta';
  end if;
end $$;
revoke all on function public.check_delete_account from public, anon;
grant execute on function public.check_delete_account to authenticated;

-- Ignorar eventos del calendario: tope por sala.
create or replace function public.set_external_ignored(p_room uuid, p_start timestamptz, p_end timestamptz, p_ignored boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.venue_rooms r where r.id = p_room and public.owns_venue(r.venue_id)) then raise exception 'solo el dueño de la sala puede hacerlo'; end if;
  if p_ignored then
    if (select count(*) from public.room_busy_ignored where room_id = p_room) >= 300 then raise exception 'demasiados eventos ignorados'; end if;
    insert into public.room_busy_ignored (room_id, starts_at, ends_at) values (p_room, p_start, p_end) on conflict do nothing;
  else
    delete from public.room_busy_ignored where room_id = p_room and starts_at = p_start and ends_at = p_end;
  end if;
end $$;
