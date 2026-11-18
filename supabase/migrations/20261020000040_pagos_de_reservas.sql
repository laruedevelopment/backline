-- Pagos de reservas SIN intermediar: Backline no recibe dinero. El dueño de la sala define cómo le pagan (Nequi, Bre-B o link de su pasarela),
-- si pide anticipo y cuántas horas espera el pago. El cliente adjunta el comprobante dentro de la app y el dueño lo aprueba.
--  · La reserva se mantiene (la franja queda apartada) mientras se espera el pago; si vence el plazo sin comprobante, se cancela sola.
--  · Si el cliente ya subió el comprobante a tiempo, la reserva NO vence: la revisión es responsabilidad del dueño.
-- Repetible.

-- ───────── Cómo cobra cada sala ─────────
alter table public.venues
  add column if not exists pay_required boolean not null default false,
  add column if not exists pay_nequi text check (pay_nequi is null or pay_nequi ~ '^[0-9 +]{7,20}$'),
  add column if not exists pay_breb text check (pay_breb is null or char_length(pay_breb) between 3 and 60),
  add column if not exists pay_link text check (pay_link is null or (char_length(pay_link) <= 300 and pay_link ~* '^https://')),
  add column if not exists pay_notes text check (pay_notes is null or char_length(pay_notes) <= 300),
  add column if not exists pay_deposit_pct int check (pay_deposit_pct is null or pay_deposit_pct between 10 and 90),
  add column if not exists pay_hold_hours int not null default 24 check (pay_hold_hours between 1 and 168);
alter table public.venues drop constraint if exists venues_pay_method_check;
alter table public.venues add constraint venues_pay_method_check
  check (not pay_required or pay_nequi is not null or pay_breb is not null or pay_link is not null);
grant update (pay_required, pay_nequi, pay_breb, pay_link, pay_notes, pay_deposit_pct, pay_hold_hours) on public.venues to authenticated;

-- ───────── Estado del pago de cada reserva ─────────
alter table public.bookings
  add column if not exists total_amount int check (total_amount is null or total_amount >= 0),
  add column if not exists deposit_amount int check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists pay_status text not null default 'not_required' check (pay_status in ('not_required', 'awaiting', 'proof_sent', 'paid')),
  add column if not exists pay_due_at timestamptz,
  add column if not exists proof_path text check (proof_path is null or char_length(proof_path) <= 200),
  add column if not exists proof_at timestamptz,
  add column if not exists pay_note text check (pay_note is null or char_length(pay_note) <= 200);
create index if not exists bookings_pay_due_idx on public.bookings (pay_due_at) where pay_status = 'awaiting';

-- ───────── Vencimiento por falta de pago ─────────
create or replace function public.expire_unpaid_bookings() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with gone as (
    update public.bookings set status = 'cancelled', response_note = 'La reserva se canceló porque venció el plazo para pagar.', responded_at = now()
    where status = 'confirmed' and pay_status = 'awaiting' and pay_due_at < now()
    returning id)
  delete from public.events where booking_id in (select id from gone);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_unpaid_bookings from public;
grant execute on function public.expire_unpaid_bookings to anon, authenticated;

-- Las franjas que esperan un pago vencido ya no ocupan la sala.
create or replace function public.room_busy(p_room uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  where b.room_id = p_room and b.status = 'confirmed'
    and not (b.pay_status = 'awaiting' and b.pay_due_at < now())
    and b.starts_at < p_to and b.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days'
  union all
  select e.starts_at, e.ends_at
  from public.room_external_busy e
  join public.venue_rooms r on r.id = e.room_id
  join public.venues v on v.id = r.venue_id
  where e.room_id = p_room
    and e.starts_at < p_to and e.ends_at > p_from
    and (v.is_published or v.owner_id = (select auth.uid()))
    and p_to - p_from <= interval '45 days';
$$;

-- ───────── Pedir una franja: guarda el total y el anticipo; con confirmación automática queda apartada esperando el pago ─────────
create or replace function public.request_booking(
  p_room uuid, p_start timestamptz, p_end timestamptz,
  p_band uuid default null, p_note text default null, p_phone text default null
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
  total int; dep int; pay boolean;
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
     or exists (select 1 from public.room_external_busy where room_id = p_room
                and tstzrange(starts_at, ends_at) && tstzrange(p_start, p_end)) then
    raise exception 'esa franja ya está ocupada';
  end if;
  if (select count(*) from public.bookings where requested_by = uid and status in ('requested', 'confirmed') and ends_at > now()) >= 6 then
    raise exception 'tienes demasiadas solicitudes pendientes';
  end if;

  st := case when v.auto_confirm then 'confirmed' else 'requested' end;
  total := case when r.price_per_hour > 0 then round(r.price_per_hour * extract(epoch from (p_end - p_start)) / 3600.0)::int end;
  pay := v.pay_required and total is not null;
  dep := case when pay then (case when v.pay_deposit_pct is not null then round(total * v.pay_deposit_pct / 100.0)::int else total end) end;
  insert into public.bookings (venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, note, status, responded_at,
                               total_amount, deposit_amount, pay_status, pay_due_at)
  values (
    v.id, p_room, p_band, uid,
    coalesce((select display_name from public.profiles where id = uid), ''),
    left(nullif(trim(p_phone), ''), 20), p_start, p_end, left(nullif(trim(p_note), ''), 300), st,
    case when st = 'confirmed' then now() end,
    total, dep,
    case when pay and st = 'confirmed' then 'awaiting' else 'not_required' end,
    case when pay and st = 'confirmed' then least(now() + make_interval(hours => v.pay_hold_hours), p_start - interval '10 minutes') end
  ) returning id into new_id;

  if st = 'confirmed' then perform public.booking_to_event(new_id); end if;
  return new_id;
end $$;

-- ───────── El dueño responde: al confirmar con cobro, empieza a correr el plazo de pago ─────────
create or replace function public.respond_booking(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v public.venues;
begin
  if p_status not in ('confirmed', 'rejected') then raise exception 'respuesta inválida'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'requested' then raise exception 'la solicitud ya no está pendiente'; end if;
  if not public.owns_venue(b.venue_id) then raise exception 'solo el dueño de la sala puede responder'; end if;
  select * into v from public.venues where id = b.venue_id;
  update public.bookings set
    status = p_status, response_note = left(nullif(trim(p_note), ''), 300), responded_at = now(),
    pay_status = case when p_status = 'confirmed' and v.pay_required and b.total_amount is not null then 'awaiting' else pay_status end,
    pay_due_at = case when p_status = 'confirmed' and v.pay_required and b.total_amount is not null then least(now() + make_interval(hours => v.pay_hold_hours), b.starts_at - interval '10 minutes') else pay_due_at end
  where id = p_id;
  if p_status = 'confirmed' then perform public.booking_to_event(p_id); end if;
end $$;

-- ───────── El cliente adjunta el comprobante ─────────
create or replace function public.attach_payment_proof(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; uid uuid := (select auth.uid());
begin
  perform public.expire_unpaid_bookings();
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'confirmed' or b.pay_status <> 'awaiting' then raise exception 'esta reserva ya no espera un pago'; end if;
  if not (b.requested_by = uid or (b.band_id is not null and public.can_edit_band(b.band_id))) then raise exception 'no puedes adjuntar el comprobante de esta reserva'; end if;
  if p_path is null or p_path not like uid::text || '/' || p_id::text || '/%' then raise exception 'ruta de comprobante inválida'; end if;
  update public.bookings set proof_path = p_path, proof_at = now(), pay_status = 'proof_sent', pay_note = null where id = p_id;
end $$;

-- ───────── El dueño aprueba (pagado), rechaza el comprobante o marca pagado sin comprobante ─────────
create or replace function public.review_payment(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; v public.venues;
begin
  if p_action not in ('paid', 'reject') then raise exception 'acción inválida'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found or b.status <> 'confirmed' then raise exception 'esta reserva ya no está confirmada'; end if;
  if not public.owns_venue(b.venue_id) then raise exception 'solo el dueño de la sala puede revisar pagos'; end if;
  select * into v from public.venues where id = b.venue_id;
  if p_action = 'paid' then
    if b.pay_status not in ('awaiting', 'proof_sent') then raise exception 'esta reserva no espera pago'; end if;
    update public.bookings set pay_status = 'paid', pay_due_at = null, pay_note = null where id = p_id;
  else
    if b.pay_status <> 'proof_sent' then raise exception 'no hay un comprobante por revisar'; end if;
    if b.proof_path is not null then delete from storage.objects where bucket_id = 'payment-proofs' and name = b.proof_path; end if;
    update public.bookings set pay_status = 'awaiting', proof_path = null, proof_at = null,
      pay_note = left(nullif(trim(p_note), ''), 200),
      pay_due_at = least(now() + make_interval(hours => v.pay_hold_hours), b.starts_at - interval '10 minutes')
    where id = p_id;
  end if;
end $$;
revoke all on function public.attach_payment_proof, public.review_payment from public, anon;
grant execute on function public.attach_payment_proof, public.review_payment to authenticated;
revoke all on function public.request_booking, public.respond_booking from public, anon;
grant execute on function public.request_booking, public.respond_booking to authenticated;

-- ───────── Comprobantes: espacio privado (el cliente y el dueño de esa sala los ven) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

create or replace function public.proof_visible_to_owner(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.id::text = (storage.foldername(path))[2] and public.owns_venue(b.venue_id));
$$;
revoke all on function public.proof_visible_to_owner from public, anon;
grant execute on function public.proof_visible_to_owner to authenticated;

drop policy if exists proofs_insert on storage.objects;
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists proofs_delete on storage.objects;
create policy proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists proofs_read on storage.objects;
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.proof_visible_to_owner(name)));

-- ───────── Los datos de pago no son públicos: solo los ve quien reservó (y el dueño) ─────────
-- Las columnas de pago se quitan de la lectura general; quien reservó las recibe con booking_pay_info y el dueño con my_pay_settings.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'venues' and column_name not in ('pay_nequi', 'pay_breb', 'pay_link', 'pay_notes');
  revoke select on public.venues from authenticated;
  execute format('grant select (%s) on public.venues to authenticated', cols);
end $$;
-- Nota: si una migración futura agrega columnas a venues, debe darles select explícito a authenticated.

create or replace function public.booking_pay_info(p_id uuid)
returns table (nequi text, breb text, link text, notes text)
language sql stable security definer set search_path = '' as $$
  select v.pay_nequi, v.pay_breb, v.pay_link, v.pay_notes
  from public.bookings b join public.venues v on v.id = b.venue_id
  where b.id = p_id
    and (b.requested_by = (select auth.uid()) or (b.band_id is not null and public.can_edit_band(b.band_id)) or v.owner_id = (select auth.uid()));
$$;

create or replace function public.my_pay_settings(p_venue uuid)
returns table (required boolean, nequi text, breb text, link text, notes text, deposit_pct int, hold_hours int)
language sql stable security definer set search_path = '' as $$
  select v.pay_required, v.pay_nequi, v.pay_breb, v.pay_link, v.pay_notes, v.pay_deposit_pct, v.pay_hold_hours
  from public.venues v where v.id = p_venue and v.owner_id = (select auth.uid());
$$;
revoke all on function public.booking_pay_info, public.my_pay_settings from public, anon;
grant execute on function public.booking_pay_info, public.my_pay_settings to authenticated;
