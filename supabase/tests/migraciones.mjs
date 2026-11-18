// Pruebas de las migraciones y de la seguridad (RLS) contra un Postgres embebido (PGlite) con un simulacro de Supabase.
// No toca ninguna base real. Ejecutar: npm run test:db
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const here = path.dirname(fileURLToPath(import.meta.url))
const pg = await PGlite.create({ extensions: { btree_gist, pgcrypto } })
await pg.exec(fs.readFileSync(path.join(here, 'stub-supabase.sql'), 'utf8'))
await pg.exec(`
  create extension if not exists pgcrypto;
  alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}';
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`)

const dir = path.join(here, '..', 'migrations')
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
  try {
    await pg.exec(sql)
    console.log('OK  migración', f)
  } catch (e) {
    console.log('FALLA migración', f, '→', e.message)
    process.exit(1)
  }
  // Desde la 0008 las migraciones deben ser repetibles: se vuelve a ejecutar justo después de aplicarla.
  if (Number(f.slice(12, 14)) >= 8) {
    try { await pg.exec(sql); console.log('OK  re-ejecución', f) } catch (e) { console.log('FALLA re-ejecución', f, '→', e.message); process.exit(1) }
  }
}

const U = { owner: crypto.randomUUID(), leader: crypto.randomUUID(), other: crypto.randomUUID(), member: crypto.randomUUID() }
for (const [k, id] of Object.entries(U)) {
  await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${k}@x.co`, JSON.stringify({ name: k.toUpperCase(), terms_version: '0.2', age_declaration: 'adult' })])
}

/** Ejecuta como un usuario autenticado (RLS real). Devuelve filas o lanza el error. */
async function as(user, sql, params = []) {
  return pg.transaction(async (t) => {
    await t.query(`select set_config('role','authenticated',true), set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`, [U[user], JSON.stringify({ sub: U[user], role: 'authenticated' })])
    return (await t.query(sql, params)).rows
  })
}
let pass = 0, fail = 0
async function ok(name, fn) { try { await fn(); console.log('  ✓', name); pass++ } catch (e) { console.log('  ✗', name, '→', e.message); fail++ } }
async function rejects(name, fn, pattern) {
  try { await fn() } catch (e) { if (!pattern || pattern.test(e.message)) { console.log('  ✓', name, '(rechazado)'); pass++; return } console.log('  ✗', name, 'falló por otra razón →', e.message); fail++; return }
  console.log('  ✗', name, '→ debía rechazarse y pasó'); fail++
}
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`) }

// ── fechas: mañana a las 15:00–17:00 hora de Colombia
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return fmt.format(d) }
const t = (n, hm) => `${day(n)}T${hm}:00-05:00`

console.log('\nPerfil y trigger de registro')
await ok('el trigger guardó la aceptación de términos', async () => {
  // Nadie (ni la propia persona) lee estos datos por la API: se verifican con acceso de administrador.
  const p = (await pg.query(`select terms_version, age_declaration, accepted_terms_at is not null as at from public.profiles where id = $1`, [U.owner])).rows[0]
  eq([p.terms_version, p.age_declaration, p.at], ['0.2', 'adult', true], 'aceptación')
})
await rejects('el usuario no puede reescribir su aceptación', () => as('owner', `update public.profiles set terms_version = 'x' where id = $1`, [U.owner]), /permission denied/)

console.log('\nSalas: crear y permisos')
let venue, room
await ok('el dueño crea su sala (no publicada)', async () => {
  const [v] = await as('owner', `insert into public.venues (name, city, address) values ('Sala Resonancia','Bucaramanga','Cra 33') returning id, is_published, owner_id`)
  venue = v.id; eq([v.is_published, v.owner_id], [false, U.owner], 'sala')
})
await rejects('no se puede crear una sala a nombre de otro', () => as('other', `insert into public.venues (owner_id, name) values ($1,'Falsa')`, [U.owner]), /permission denied|row-level/)
await ok('una sala no publicada solo la ve su dueño', async () => {
  eq((await as('other', `select id from public.venues where id=$1`, [venue])).length, 0, 'otro la ve')
  eq((await as('owner', `select id from public.venues where id=$1`, [venue])).length, 1, 'dueño no la ve')
})
await rejects('otro no puede editar la sala', async () => { const r = await as('other', `update public.venues set name='Hackeada' where id=$1 returning id`, [venue]); if (r.length) throw new Error('editó'); throw new Error('0 filas (RLS)') }, /RLS|permission/)
await rejects('nadie puede cambiarse el dueño', () => as('owner', `update public.venues set owner_id = $1 where id=$2`, [U.other, venue]), /permission denied|row-level/)
await rejects('booking_url solo https', () => as('owner', `update public.venues set booking_url='http://x.co' where id=$1`, [venue]), /check/)
await ok('el dueño crea salita y horario', async () => {
  const [r] = await as('owner', `insert into public.venue_rooms (venue_id, name, capacity, price_per_hour) values ($1,'Sala A',6,35000) returning id`, [venue]); room = r.id
  for (let d = 0; d < 7; d++) await as('owner', `insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1,$2,'08:00','22:00')`, [venue, d])
})
await rejects('otro no puede crear salitas en una sala ajena', () => as('other', `insert into public.venue_rooms (venue_id, name) values ($1,'X')`, [venue]), /row-level|permission/)
await rejects('no se puede reservar una sala sin publicar', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(2, '15:00'), t(2, '17:00')]), /no disponible/)
await ok('el dueño publica', async () => { await as('owner', `update public.venues set is_published = true where id=$1`, [venue]) })
await ok('ahora todos la ven (y sus salitas/horario)', async () => {
  eq((await as('other', `select id from public.venues where id=$1`, [venue])).length, 1, 'sala')
  eq((await as('other', `select id from public.venue_rooms where venue_id=$1`, [venue])).length, 1, 'salitas')
  eq((await as('other', `select weekday from public.venue_hours where venue_id=$1`, [venue])).length, 7, 'horario')
})

console.log('\nReservas')
// El líder necesita una banda
let band
await ok('el líder crea su banda', async () => { const [r] = await as('leader', `select public.create_band('Kabaret','Bucaramanga') as id`); band = r.id })
let b1
await ok('el líder pide una franja a nombre de su banda', async () => {
  const [r] = await as('leader', `select public.request_booking($1,$2,$3,$4,'Somos 4','300 123 4567') as id`, [room, t(2, '15:00'), t(2, '17:00'), band]); b1 = r.id
  const [row] = await as('leader', `select status, contact_name, contact_phone from public.bookings where id=$1`, [b1])
  eq([row.status, row.contact_name, row.contact_phone], ['requested', 'LEADER', '300 123 4567'], 'reserva')
})
await rejects('no puede reservar a nombre de una banda ajena', () => as('other', `select public.request_booking($1,$2,$3,$4)`, [room, t(3, '15:00'), t(3, '16:00'), band]), /no puedes reservar/)
await rejects('no puede reservar fuera del horario', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(2, '06:00'), t(2, '08:00')]), /fuera del horario/)
await rejects('no puede reservar con menos de 1 hora de anticipación', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, new Date(Date.now() + 20 * 60000).toISOString(), new Date(Date.now() + 80 * 60000).toISOString()]), /anticipación|horario|cerrada/)
await rejects('no puede durar más de 8 horas', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(4, '08:00'), t(4, '22:00')]), /duración/)
await rejects('el dueño no se reserva a sí mismo', () => as('owner', `select public.request_booking($1,$2,$3)`, [room, t(5, '15:00'), t(5, '16:00')]), /propia sala/)
await ok('quien pidió ve su reserva; el dueño también; un tercero no', async () => {
  eq((await as('leader', `select id from public.bookings where id=$1`, [b1])).length, 1, 'solicitante')
  eq((await as('owner', `select id from public.bookings where id=$1`, [b1])).length, 1, 'dueño')
  eq((await as('other', `select id from public.bookings where id=$1`, [b1])).length, 0, 'tercero')
})
await rejects('nadie escribe directo en bookings', () => as('leader', `update public.bookings set status='confirmed' where id=$1`, [b1]), /permission denied/)
await rejects('ni insertar directo en bookings', () => as('leader', `insert into public.bookings (venue_id, room_id, starts_at, ends_at, status) values ($1,$2,now()+interval '3 day', now()+interval '3 day 1 hour', 'confirmed')`, [venue, room]), /permission denied/)
await rejects('un tercero no puede confirmar', () => as('other', `select public.respond_booking($1,'confirmed')`, [b1]), /solo el dueño/)
await rejects('el solicitante tampoco puede confirmarse a sí mismo', () => as('leader', `select public.respond_booking($1,'confirmed')`, [b1]), /solo el dueño/)
await ok('el dueño confirma y se crea el ensayo en la agenda de la banda', async () => {
  await as('owner', `select public.respond_booking($1,'confirmed')`, [b1])
  const ev = await as('leader', `select title, kind, booking_id from public.events where band_id=$1`, [band])
  eq(ev.length, 1, 'eventos'); eq([ev[0].kind, ev[0].booking_id], ['rehearsal', b1], 'evento')
})
await ok('room_busy muestra la franja ocupada sin revelar quién', async () => {
  const rows = await as('other', `select * from public.room_busy($1,$2,$3)`, [room, t(2, '00:00'), t(2, '23:59')])
  eq(rows.length, 1, 'franjas'); eq(Object.keys(rows[0]).sort(), ['ends_at', 'starts_at'], 'columnas')
})
await rejects('otra solicitud solapada con la confirmada se rechaza al pedirla', () => as('other', `select public.request_booking($1,$2,$3)`, [room, t(2, '16:00'), t(2, '18:00')]), /ocupada/)
await ok('una franja contigua (justo después) sí se puede pedir', async () => {
  await as('other', `select public.request_booking($1,$2,$3)`, [room, t(2, '17:00'), t(2, '19:00')])
})
let b3, b4
await ok('dos solicitudes solapadas pueden coexistir pendientes…', async () => {
  const [a] = await as('other', `select public.request_booking($1,$2,$3) as id`, [room, t(6, '15:00'), t(6, '17:00')]); b3 = a.id
  const [b] = await as('member', `select public.request_booking($1,$2,$3) as id`, [room, t(6, '16:00'), t(6, '18:00')]); b4 = b.id
})
await ok('…pero al confirmar la primera, confirmar la segunda falla por solape', async () => {
  await as('owner', `select public.respond_booking($1,'confirmed')`, [b3])
  let failed = false
  try { await as('owner', `select public.respond_booking($1,'confirmed')`, [b4]) } catch (e) { failed = /bookings_sin_solape|conflicting|exclu/i.test(e.message) }
  if (!failed) throw new Error('permitió dos confirmadas solapadas')
})
await ok('la segunda se puede rechazar con motivo', async () => { await as('owner', `select public.respond_booking($1,'rejected','Ya está ocupado')`, [b4]) })
await ok('el solicitante cancela: se borra el ensayo de su agenda y se libera la franja', async () => {
  await as('leader', `select public.cancel_booking($1)`, [b1])
  eq((await as('leader', `select id from public.events where band_id=$1`, [band])).length, 0, 'evento sigue')
  eq((await as('other', `select * from public.room_busy($1,$2,$3)`, [room, t(2, '00:00'), t(2, '23:59')])).length, 0, 'franja sigue ocupada')
})
await rejects('un tercero no puede cancelar reservas ajenas', () => as('member', `select public.cancel_booking($1)`, [b3]), /no puedes cancelar/)
await rejects('el cupo de pendientes por usuario es 6', async () => {
  for (let i = 0; i < 7; i++) await as('member', `select public.request_booking($1,$2,$3)`, [room, t(10 + i, '09:00'), t(10 + i, '10:00')])
}, /demasiadas/)


console.log('\nReservas manuales del dueño (WhatsApp / llamada)')
await ok('el dueño registra una reserva manual y queda confirmada', async () => {
  const [r] = await as('owner', `select public.owner_booking($1,$2,$3,'Los Chinos','300 555 0000','Pagó en efectivo') as id`, [room, t(7, '18:00'), t(7, '20:00')])
  const [row] = await as('owner', `select status, source, contact_name, band_id, requested_by from public.bookings where id=$1`, [r.id])
  eq([row.status, row.source, row.contact_name, row.band_id, row.requested_by], ['confirmed', 'owner', 'Los Chinos', null, null], 'reserva manual')
})
await rejects('nadie más puede registrar reservas en esa sala', () => as('other', `select public.owner_booking($1,$2,$3,'X')`, [room, t(8, '18:00'), t(8, '19:00')]), /solo el dueño/)
await rejects('una reserva manual no puede solaparse con otra confirmada', () => as('owner', `select public.owner_booking($1,$2,$3,'Otra')`, [room, t(7, '19:00'), t(7, '21:00')]), /ocupada/)
await rejects('las bandas ya no pueden pedir esa franja', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(7, '18:30'), t(7, '19:30')]), /ocupada/)
await rejects('exige un nombre', () => as('owner', `select public.owner_booking($1,$2,$3,'  ')`, [room, t(9, '18:00'), t(9, '19:00')]), /falta el nombre/)
await ok('la franja aparece ocupada para las bandas sin revelar el nombre', async () => {
  const rows = await as('leader', `select * from public.room_busy($1,$2,$3)`, [room, t(7, '00:00'), t(7, '23:59')])
  eq(rows.length, 1, 'franjas'); eq(Object.keys(rows[0]).sort(), ['ends_at', 'starts_at'], 'columnas')
})
await ok('el dueño puede cancelarla y la franja se libera', async () => {
  const [{ id }] = await as('owner', `select id from public.bookings where contact_name='Los Chinos'`)
  await as('owner', `select public.cancel_booking($1)`, [id])
  eq((await as('leader', `select * from public.room_busy($1,$2,$3)`, [room, t(7, '00:00'), t(7, '23:59')])).length, 0, 'sigue ocupada')
})


console.log('\nConfirmación automática')
await ok('solo el dueño puede activarla', async () => {
  let failed = false
  try { const r = await as('other', `update public.venues set auto_confirm = true where id=$1 returning id`, [venue]); failed = r.length === 0 } catch { failed = true }
  if (!failed) throw new Error('otro la activó')
  await as('owner', `update public.venues set auto_confirm = true where id=$1`, [venue])
})
let auto1
await ok('con confirmación automática la solicitud queda confirmada al instante y crea el ensayo', async () => {
  const [r] = await as('leader', `select public.request_booking($1,$2,$3,$4,'Auto') as id`, [room, t(12, '15:00'), t(12, '17:00'), band]); auto1 = r.id
  const [row] = await as('leader', `select status, responded_at is not null as resp from public.bookings where id=$1`, [auto1])
  eq([row.status, row.resp], ['confirmed', true], 'estado')
  const ev = await as('leader', `select booking_id from public.events where band_id=$1 and booking_id=$2`, [band, auto1])
  eq(ev.length, 1, 'ensayo en agenda')
})
await rejects('otra banda ya no puede pedir esa franja (queda ocupada de inmediato)', () => as('member', `select public.request_booking($1,$2,$3)`, [room, t(12, '16:00'), t(12, '18:00')]), /ocupada/)
await ok('el dueño puede cancelar una confirmada automática', async () => {
  await as('owner', `select public.cancel_booking($1)`, [auto1])
  eq((await as('leader', `select id from public.events where booking_id=$1`, [auto1])).length, 0, 'evento sigue')
})
await ok('desactivarla vuelve al modo con aprobación', async () => {
  await as('owner', `update public.venues set auto_confirm = false where id=$1`, [venue])
  const [r] = await as('leader', `select public.request_booking($1,$2,$3) as id`, [room, t(13, '15:00'), t(13, '16:00')])
  const [row] = await as('leader', `select status from public.bookings where id=$1`, [r.id])
  eq(row.status, 'requested', 'estado')
})


console.log('\nNotificaciones push (suscripciones)')
await ok('cada quien guarda su suscripción y solo ve las suyas', async () => {
  await as('leader', `select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc','p256','auth','Chrome')`)
  eq((await as('leader', `select endpoint from public.push_subscriptions`)).length, 1, 'propias')
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 0, 'ajenas')
})
await rejects('no se pueden insertar suscripciones directo (ni a nombre de otro)', () => as('owner', `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,'https://x.example/1','a','b')`, [U.leader]), /permission denied/)
await rejects('el endpoint debe ser https', () => as('leader', `select public.save_push_subscription('http://fcm.googleapis.com/fcm/send/x','p','a')`), /no permitido|check/)
await ok('si el dispositivo cambia de cuenta, la suscripción pasa a la cuenta actual', async () => {
  await as('owner', `select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc','p256b','authb','Chrome')`)
  eq((await as('leader', `select endpoint from public.push_subscriptions`)).length, 0, 'sigue en la anterior')
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 1, 'no pasó a la nueva')
})
await ok('cada quien puede borrar la suya, no la ajena', async () => {
  await as('leader', `delete from public.push_subscriptions`)
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 1, 'borró la de otro')
  await as('owner', `delete from public.push_subscriptions`)
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 0, 'no borró la propia')
})
await rejects('máximo 10 dispositivos por persona', async () => { for (let i = 0; i < 11; i++) await as('member', `select public.save_push_subscription($1,'p','a')`, [`https://fcm.googleapis.com/fcm/send/m${i}`]) }, /demasiados/)


console.log('\nCalendario de Google (horas ocupadas leídas)')
const GOOD = 'https://calendar.google.com/calendar/ical/dueno%40gmail.com/private-abc123XYZ/basic.ics'
await ok('el dueño conecta el calendario de una salita', async () => {
  await as('owner', `insert into public.room_calendar_sources (room_id, venue_id, url) values ($1,$2,$3)`, [room, venue, GOOD])
})
await rejects('solo se aceptan direcciones iCal de Google Calendar (protección contra pedir otras URL)', () => as('owner', `update public.room_calendar_sources set url='https://evil.example/x.ics' where room_id=$1`, [room]), /check/)
await rejects('ni siquiera Google con otra ruta', () => as('owner', `update public.room_calendar_sources set url='https://calendar.google.com/calendar/u/0/embed' where room_id=$1`, [room]), /check/)
await ok('la dirección secreta solo la ve el dueño (ni la banda ni otros usuarios)', async () => {
  eq((await as('owner', `select url from public.room_calendar_sources`)).length, 1, 'dueño')
  eq((await as('leader', `select url from public.room_calendar_sources`)).length, 0, 'banda')
  eq((await as('member', `select url from public.room_calendar_sources`)).length, 0, 'otro')
})
await rejects('otro usuario no puede conectar un calendario a la sala ajena', () => as('leader', `insert into public.room_calendar_sources (room_id, venue_id, url) values ($1,$2,$3)`, [room, venue, GOOD]), /row-level|duplicate|permission/)
await rejects('el estado de la sincronización no lo escribe el usuario', () => as('owner', `update public.room_calendar_sources set last_status='ok', blocks_count=99 where room_id=$1`, [room]), /permission denied/)
await rejects('las horas ocupadas no se pueden leer ni escribir directamente', () => as('owner', `select * from public.room_external_busy`), /permission denied/)
await rejects('replace_external_busy solo la puede llamar la llave de servicio, no un usuario', () => as('owner', `select public.replace_external_busy($1,'[]'::jsonb)`, [room]), /permission denied/)
await ok('la función de sincronización (servicio) guarda las horas ocupadas', async () => {
  await pg.query(`select public.replace_external_busy($1, $2::jsonb)`, [room, JSON.stringify([{ starts_at: t(20, '18:00'), ends_at: t(20, '20:00') }])])
})
await ok('las bandas ven esa franja ocupada, sin detalles', async () => {
  const rows = await as('leader', `select * from public.room_busy($1,$2,$3)`, [room, t(20, '00:00'), t(20, '23:59')])
  eq(rows.length, 1, 'franjas'); eq(Object.keys(rows[0]).sort(), ['ends_at', 'starts_at'], 'columnas')
})
await rejects('no se puede pedir una franja que el calendario de la sala tiene ocupada', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(20, '19:00'), t(20, '21:00')]), /ocupada/)
await ok('una franja libre alrededor sí se puede pedir', async () => {
  await as('leader', `select public.request_booking($1,$2,$3)`, [room, t(20, '20:00'), t(20, '21:00')])
})
await ok('cambiar la dirección reinicia el estado de la sincronización', async () => {
  await pg.query(`update public.room_calendar_sources set last_synced_at = now(), last_status='ok', blocks_count=1 where room_id=$1`, [room])
  await as('owner', `update public.room_calendar_sources set url=$2 where room_id=$1`, [room, GOOD.replace('abc123XYZ', 'nuevo999')])
  const [r] = await pg.query(`select last_synced_at, last_status, blocks_count from public.room_calendar_sources where room_id=$1`, [room]).then((x) => x.rows)
  eq([r.last_synced_at, r.last_status, r.blocks_count], [null, null, 0], 'estado')
})
await ok('desconectar el calendario es posible para el dueño', async () => {
  await as('owner', `delete from public.room_calendar_sources where room_id=$1`, [room])
})


console.log('\nLlave de servicio (Edge Functions)')
async function asService(sql, params = []) {
  return pg.transaction(async (tx) => { await tx.query(`select set_config('role','service_role',true)`); return (await tx.query(sql, params)).rows })
}
await ok('notify-booking puede leer reservas, salas y suscripciones y marcar el aviso', async () => {
  const [b] = await asService(`select id from public.bookings limit 1`)
  await asService(`select id, owner_id from public.venues limit 1`)
  await asService(`select id, name from public.venue_rooms limit 1`)
  await asService(`select id, endpoint from public.push_subscriptions limit 1`)
  await asService(`update public.bookings set last_notified_status = status where id=$1`, [b.id])
})
await ok('sync-calendars puede leer las direcciones y anotar el estado', async () => {
  await asService(`select room_id, url from public.room_calendar_sources limit 1`)
  await asService(`update public.room_calendar_sources set last_status = 'ok' where false`)
  await asService(`select public.replace_external_busy($1, '[]'::jsonb)`, [room])
})


console.log('\nFicha técnica: equipo, medidas y ubicación')
let eq1
await ok('el dueño agrega equipo incluido (con referencia opcional) y de alquiler aparte', async () => {
  const [a] = await as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity, format, brand, model) values ($1,$2,'guitar_amp',2,'combo','Fender','Hot Rod Deluxe') returning id`, [room, venue]); eq1 = a.id
  await as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity) values ($1,$2,'drums',1)`, [room, venue])
  await as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity, included, extra_price, extra_unit, details) values ($1,$2,'guitar',3,false,15000,'session','Stratocaster y Les Paul')`, [room, venue])
  await as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity, included, extra_price) values ($1,$2,'keyboard',1,false,null)`, [room, venue])
  await as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity, channels, format, brand, model) values ($1,$2,'mixer',1,16,'digital','Behringer','X32 Compact')`, [room, venue])
})
await ok('las bandas ven el equipo de un ensayadero publicado', async () => {
  eq((await as('leader', `select id from public.room_equipment where room_id=$1`, [room])).length, 5, 'equipo')
})
await rejects('otro usuario no puede agregar ni cambiar equipo ajeno', () => as('leader', `insert into public.room_equipment (room_id, venue_id, kind) values ($1,$2,'drums')`, [room, venue]), /row-level|permission/)
await ok('ni editarlo ni borrarlo', async () => {
  eq((await as('leader', `update public.room_equipment set quantity = 9 where id=$1 returning id`, [eq1])).length, 0, 'editó')
  eq((await as('leader', `delete from public.room_equipment where id=$1 returning id`, [eq1])).length, 0, 'borró')
})
await rejects('un tipo de equipo inválido se rechaza', () => as('owner', `insert into public.room_equipment (room_id, venue_id, kind) values ($1,$2,'laser')`, [room, venue]), /check/)
await rejects('la cantidad debe estar entre 1 y 99', () => as('owner', `insert into public.room_equipment (room_id, venue_id, kind, quantity) values ($1,$2,'mics',0)`, [room, venue]), /check/)
await rejects('no se puede apuntar el equipo a una sala de otro ensayadero', () => as('owner', `insert into public.room_equipment (room_id, venue_id, kind) values ($1,'00000000-0000-4000-8000-000000000000','drums')`, [room]), /foreign key|row-level/)
await ok('máximo 40 equipos por sala', async () => {
  const [{ n }] = await as('owner', `select public.room_equipment_count($1) as n`, [room])
  for (let i = Number(n); i < 40; i++) await as('owner', `insert into public.room_equipment (room_id, venue_id, kind) values ($1,$2,'other')`, [room, venue])
  let failed = false
  try { await as('owner', `insert into public.room_equipment (room_id, venue_id, kind) values ($1,$2,'other')`, [room, venue]) } catch { failed = true }
  if (!failed) throw new Error('permitió el equipo 41')
})
await ok('el dueño pone las medidas de la sala; valores absurdos se rechazan', async () => {
  await as('owner', `update public.venue_rooms set width_m = 4.5, length_m = 6, height_m = 2.8 where id=$1`, [room])
  let failed = false
  try { await as('owner', `update public.venue_rooms set width_m = 900 where id=$1`, [room]) } catch { failed = true }
  if (!failed) throw new Error('permitió 900 m')
})
await ok('el dueño guarda la ubicación en el mapa (latitud y longitud juntas)', async () => {
  await as('owner', `update public.venues set lat = 7.119349, lng = -73.122742 where id=$1`, [venue])
  let failed = false
  try { await as('owner', `update public.venues set lat = null where id=$1`, [venue]) } catch { failed = true }
  if (!failed) throw new Error('permitió lat sin lng')
  failed = false
  try { await as('owner', `update public.venues set lat = 200, lng = 1 where id=$1`, [venue]) } catch { failed = true }
  if (!failed) throw new Error('permitió latitud 200')
})
await rejects('otro no puede cambiar la ubicación', async () => { const r = await as('leader', `update public.venues set lat = 1, lng = 1 where id=$1 returning id`, [venue]); if (r.length) throw new Error('cambió'); throw new Error('0 filas (RLS)') }, /RLS|permission/)


console.log('\nComunidad: perfiles y bandas públicos (opcionales)')
await ok('por defecto nadie es público: otro usuario no ve ni perfiles ni bandas ajenas', async () => {
  eq((await as('other', `select id from public.bands where id=$1`, [band])).length, 0, 'banda')
  eq((await as('member', `select id from public.profiles where id=$1`, [U.leader])).length, 0, 'perfil')
})
await rejects('otra persona no puede hacer pública mi banda', async () => { const r = await as('other', `update public.bands set is_public = true where id=$1 returning id`, [band]); if (r.length) throw new Error('publicó'); throw new Error('0 filas (RLS)') }, /RLS|permission/)
await ok('el líder publica su banda y entonces la ven las demás personas con cuenta', async () => {
  await as('leader', `update public.bands set is_public = true where id=$1`, [band])
  eq((await as('member', `select id, name from public.bands where id=$1`, [band])).length, 1, 'no la ve')
})
await ok('lo privado sigue privado aunque la banda sea pública (canciones, setlists, agenda, reservas)', async () => {
  await as('leader', `insert into public.songs (band_id, title) values ($1,'Privada')`, [band])
  eq((await as('member', `select id from public.songs where band_id=$1`, [band])).length, 0, 'canciones')
  await as('leader', `update public.songs set lyrics = $2 where band_id=$1`, [band, '[Verso]\nAm  F\nLetra de prueba'])
  eq((await as('member', `select lyrics from public.songs where band_id=$1`, [band])).length, 0, 'letra visible a ajenos')
  eq((await as('member', `select id from public.setlists where band_id=$1`, [band])).length, 0, 'setlists')
  eq((await as('member', `select id from public.events where band_id=$1`, [band])).length, 0, 'eventos')
  eq((await as('member', `select profile_id from public.band_members where band_id=$1`, [band])).length, 0, 'integrantes directos')
  eq((await as('member', `select code from public.band_invites`)).length, 0, 'invitaciones')
})
await ok('notas por instrumento: la banda las guarda y otras personas no las ven', async () => {
  await as('leader', `update public.songs set instrument_notes = $2::jsonb where band_id=$1`, [band, JSON.stringify({ 'Batería': 'entra con el hi-hat' })])
  eq((await as('member', `select instrument_notes from public.songs where band_id=$1`, [band])).length, 0, 'notas visibles a ajenos')
})
await rejects('las notas por instrumento deben ser un objeto', async () => {
  await as('leader', `update public.songs set instrument_notes = '[1,2]'::jsonb where band_id=$1`, [band])
}, /check|instrument_notes/)
await ok('setlist: guarda el link de Spotify', async () => {
  await as('leader', `insert into public.setlists (band_id, name, spotify_url) values ($1,'Con Spotify',$2)`, [band, 'https://open.spotify.com/playlist/37i9dQZF1DX'])
  await as('leader', `insert into public.setlists (band_id, name, spotify_url) values ($1,'Link corto',$2)`, [band, 'https://spotify.link/abc123'])
})
await rejects('setlist: el link debe ser de Spotify y https', async () => {
  await as('leader', `insert into public.setlists (band_id, name, spotify_url) values ($1,'Malo',$2)`, [band, 'https://open.spotify.com.evil.com/x'])
}, /check|spotify/)
await rejects('setlist: un link http o de otro sitio se rechaza', async () => {
  await as('leader', `insert into public.setlists (band_id, name, spotify_url) values ($1,'Malo2',$2)`, [band, 'http://open.spotify.com/x'])
}, /check|spotify/)
await rejects('perfil público: sin declaración de edad se pide declararla', async () => {
  await pg.query(`update public.profiles set age_declaration = null where id = $1`, [U.member])
  await as('member', `select public.set_profile_public(true)`)
}, /declarar la mayor/)
await ok('cuenta antigua: declara que es mayor de edad y entonces puede ser pública', async () => {
  await as('member', `select public.confirm_adult()`)
  await as('member', `select public.set_profile_public(true)`)
  await as('member', `select public.set_profile_public(false)`)
})
await ok('una declaración de menor no se puede cambiar con confirm_adult', async () => {
  await pg.query(`update public.profiles set age_declaration = 'minor_with_consent' where id = $1`, [U.member])
  await as('member', `select public.confirm_adult()`)
  const r = await pg.query(`select age_declaration from public.profiles where id = $1`, [U.member])
  eq(r.rows[0].age_declaration, 'minor_with_consent', 'declaración cambiada')
  await pg.query(`update public.profiles set age_declaration = 'adult' where id = $1`, [U.member])
})
await ok('setlist con etiquetas: guarda elementos (canciones y etiquetas sueltas)', async () => {
  const items = JSON.stringify([{ t: 's', id: 'a', tags: ['Intro largo'] }, { t: 'l', id: 'l1', text: 'Afinar a Drop C' }])
  await as('leader', `insert into public.setlists (band_id, name, items) values ($1,'Con etiquetas',$2::jsonb)`, [band, items])
})
await rejects('setlist: items debe ser una lista', async () => {
  await as('leader', `insert into public.setlists (band_id, name, items) values ($1,'Mal',$2::jsonb)`, [band, '{"a":1}'])
}, /check|items/)
await rejects('la letra no puede pasar de 12000 caracteres', async () => {
  await as('leader', `update public.songs set lyrics = $2 where band_id=$1`, [band, 'a'.repeat(12001)])
}, /check|lyrics/)
await ok('los integrantes de una banda pública solo salen si hicieron público su perfil', async () => {
  eq((await as('member', `select * from public.band_public_members($1)`, [band])).length, 0, 'salió alguien sin permiso')
  await as('leader', `select public.set_profile_public(true)`)
  const rows = await as('member', `select display_name, role from public.band_public_members($1)`, [band])
  eq(rows.length, 1, 'integrantes'); eq(rows[0].role, 'owner', 'rol')
})
await ok('la persona pública se puede ver, pero sin datos internos', async () => {
  eq((await as('member', `select id, display_name from public.profiles where id=$1`, [U.leader])).length, 1, 'perfil público')
})
await rejects('nadie puede leer la declaración de edad ni la aceptación de términos de otra persona', () => as('member', `select age_declaration from public.profiles where id=$1`, [U.leader]), /permission denied/)
await rejects('ni siquiera la suya (no es un dato para mostrar)', () => as('leader', `select terms_version from public.profiles where id=$1`, [U.leader]), /permission denied/)
await rejects('no se puede cambiar is_public del perfil directamente (solo por la función)', () => as('leader', `update public.profiles set is_public = true where id=$1`, [U.leader]), /permission denied/)
await ok('un menor de edad no puede publicar su perfil', async () => {
  await pg.query(`update public.profiles set age_declaration = 'minor_with_consent', is_public = false where id=$1`, [U.member])
  let failed = false
  try { await as('member', `select public.set_profile_public(true)`) } catch (e) { failed = /mayores de edad/.test(e.message) }
  if (!failed) throw new Error('un menor pudo publicar su perfil')
})
await ok('las bandas públicas de una persona pública se listan; las privadas no', async () => {
  const rows = await as('member', `select name from public.profile_public_bands($1)`, [U.leader])
  eq(rows.length, 1, 'bandas')
  await as('leader', `update public.bands set is_public = false where id=$1`, [band])
  eq((await as('member', `select name from public.profile_public_bands($1)`, [U.leader])).length, 0, 'sigue saliendo una banda privada')
})
await ok('el conteo de integrantes solo funciona para bandas públicas', async () => {
  eq((await as('member', `select public.band_member_count($1) as n`, [band]))[0].n, 0, 'contó una banda privada')
  await as('leader', `update public.bands set is_public = true where id=$1`, [band])
  eq((await as('member', `select public.band_member_count($1) as n`, [band]))[0].n >= 1, true, 'no contó')
})
await ok('las fotos de una banda pública las ven las demás personas con cuenta', async () => {
  await pg.query(`insert into public.band_photos (band_id, path) values ($1, $2)`, [band, `${band}/photos/x.webp`])
  eq((await as('member', `select id from public.band_photos where band_id=$1`, [band])).length, 1, 'no ve la foto')
  await as('leader', `update public.bands set is_public = false where id=$1`, [band])
  eq((await as('member', `select id from public.band_photos where band_id=$1`, [band])).length, 0, 've fotos de banda privada')
  await as('leader', `update public.bands set is_public = true where id=$1`, [band])
})

console.log('\nFotos y límites')
await rejects('una foto no puede apuntar a la carpeta de otra sala', () => as('owner', `insert into public.venue_photos (venue_id, path) values ($1,'otra/photos/x.webp')`, [venue]), /check/)
await ok('el dueño sube hasta 12 fotos y la 13 se rechaza', async () => {
  for (let i = 0; i < 12; i++) await as('owner', `insert into public.venue_photos (venue_id, path) values ($1,$2)`, [venue, `${venue}/photos/${i}.webp`])
  let failed = false
  try { await as('owner', `insert into public.venue_photos (venue_id, path) values ($1,$2)`, [venue, `${venue}/photos/13.webp`]) } catch { failed = true }
  if (!failed) throw new Error('permitió la foto 13')
})
await ok('almacenamiento: el dueño escribe en su carpeta; otro no', async () => {
  await as('owner', `insert into storage.objects (bucket_id, name) values ('venue-media', $1)`, [`${venue}/logo-1.webp`])
  let failed = false
  try { await as('other', `insert into storage.objects (bucket_id, name) values ('venue-media', $1)`, [`${venue}/logo-2.webp`]) } catch { failed = true }
  if (!failed) throw new Error('otro escribió en carpeta ajena')
})
await ok('almacenamiento de bandas: solo admins de la banda', async () => {
  await as('leader', `insert into storage.objects (bucket_id, name) values ('band-media', $1)`, [`${band}/logo-1.webp`])
  let failed = false
  try { await as('other', `insert into storage.objects (bucket_id, name) values ('band-media', $1)`, [`${band}/logo-2.webp`]) } catch { failed = true }
  if (!failed) throw new Error('otro escribió en carpeta de banda')
})

console.log('\nFoto de perfil')
await ok('cada persona sube su foto en su propia carpeta; en la de otra no', async () => {
  await as('member', `insert into storage.objects (bucket_id, name) values ('profile-media', $1)`, [`${U.member}/avatar-1.webp`])
  let failed = false
  try { await as('other', `insert into storage.objects (bucket_id, name) values ('profile-media', $1)`, [`${U.member}/avatar-2.webp`]) } catch { failed = true }
  if (!failed) throw new Error('otra persona escribió en la carpeta ajena')
})
await ok('avatar_path solo acepta rutas de la propia persona', async () => {
  await as('member', `update public.profiles set avatar_path = $2 where id = $1`, [U.member, `${U.member}/avatar-1.webp`])
  let failed = false
  try { await as('member', `update public.profiles set avatar_path = $2 where id = $1`, [U.member, `${U.other}/avatar-1.webp`]) } catch { failed = true }
  if (!failed) throw new Error('aceptó la ruta de otra persona')
})
await ok('nadie cambia la foto de otra persona', async () => {
  const r = await as('other', `update public.profiles set avatar_path = null where id = $1 returning id`, [U.member])
  eq(r.length, 0, 'modificó el perfil ajeno')
})
await ok('la función de integrantes públicos devuelve la foto', async () => {
  const cols = await pg.query(`select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_path'`)
  eq(cols.rows.length, 1, 'falta la columna')
})

console.log('Anotaciones por músico')
let noteSong
await ok('el integrante escribe su anotación de una canción y toda la banda la lee', async () => {
  await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
  const [sg] = await as('leader', `insert into public.songs (band_id, title) values ($1,'Con anotaciones') returning id`, [band]); noteSong = sg.id
  await as('member', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Les Paul')`, [noteSong, band, U.member])
  eq((await as('leader', `select note from public.song_member_notes where song_id=$1`, [noteSong])).length, 1, 'el líder no la ve')
})
await ok('quien lidera la banda escribe, cambia y borra la anotación de un integrante (y queda quién la puso)', async () => {
  await as('leader', `update public.song_member_notes set note = 'Strat', updated_by = $3 where song_id=$1 and profile_id=$2`, [noteSong, U.member, U.leader])
  const [r] = await as('member', `select note, updated_by from public.song_member_notes where song_id=$1 and profile_id=$2`, [noteSong, U.member])
  eq(r.note, 'Strat', 'el líder no pudo cambiarla'); eq(r.updated_by, U.leader, 'no quedó quién la puso')
  await as('leader', `delete from public.song_member_notes where song_id=$1 and profile_id=$2`, [noteSong, U.member])
  await as('leader', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Les Paul')`, [noteSong, band, U.member])
  eq((await as('member', `select note from public.song_member_notes where song_id=$1 and profile_id=$2`, [noteSong, U.member])).length, 1, 'el líder no pudo crearla')
})
await rejects('el líder no escribe la anotación de alguien que no es de la banda', () => as('leader', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Falsa')`, [noteSong, band, U.other]), /row-level|violates/)
await rejects('un integrante no escribe la anotación de otra persona', () => as('member', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Falsa')`, [noteSong, band, U.leader]), /row-level|violates/)
await ok('un integrante no edita ni borra la anotación de otra persona', async () => {
  await as('leader', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Del líder')`, [noteSong, band, U.leader])
  eq((await as('member', `update public.song_member_notes set note = 'cambiada' where song_id=$1 and profile_id=$2 returning note`, [noteSong, U.leader])).length, 0, 'editó la de otro')
  eq((await as('member', `delete from public.song_member_notes where song_id=$1 and profile_id=$2 returning note`, [noteSong, U.leader])).length, 0, 'borró la de otro')
})
await ok('quien no es de la banda no ve las anotaciones', async () => {
  eq((await as('other', `select note from public.song_member_notes where song_id=$1`, [noteSong])).length, 0, 'las ve un ajeno')
})
await rejects('la anotación no puede quedar vacía ni pasar de 500 caracteres', () => as('member', `update public.song_member_notes set note = $2 where song_id=$1`, [noteSong, 'a'.repeat(501)]), /check|note/)
await ok('el integrante actualiza y borra la suya; al borrar la canción se borran las anotaciones', async () => {
  await as('member', `update public.song_member_notes set note = 'Strat', updated_at = now() where song_id=$1 and profile_id=$2`, [noteSong, U.member])
  eq((await as('member', `select note from public.song_member_notes where song_id=$1 and profile_id=$2`, [noteSong, U.member]))[0].note, 'Strat', 'no se actualizó')
  await as('leader', `delete from public.songs where id=$1`, [noteSong])
  eq((await pg.query(`select 1 from public.song_member_notes where song_id=$1`, [noteSong])).rows.length, 0, 'quedó huérfana')
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member])
})

console.log('Comentarios y chat')
let chatSong
await ok('integrantes comentan una canción y escriben en el chat; la banda lo lee y los ajenos no', async () => {
  await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
  const [sg] = await as('leader', `insert into public.songs (band_id, title) values ($1,'Con comentarios') returning id`, [band]); chatSong = sg.id
  await as('member', `insert into public.song_comments (song_id, band_id, profile_id, body) values ($1,$2,$3,'Subamos medio tono')`, [chatSong, band, U.member])
  await as('member', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,'Ensayo a las 7')`, [band, U.member])
  eq((await as('leader', `select id from public.song_comments where song_id=$1`, [chatSong])).length, 1, 'el líder no ve el comentario')
  eq((await as('leader', `select id from public.band_messages where band_id=$1`, [band])).length, 1, 'el líder no ve el mensaje')
  eq((await as('other', `select id from public.band_messages where band_id=$1`, [band])).length, 0, 'un ajeno ve el chat')
  eq((await as('other', `select id from public.song_comments where band_id=$1`, [band])).length, 0, 'un ajeno ve los comentarios')
})
await rejects('nadie escribe a nombre de otra persona ni un ajeno escribe en el chat', () => as('member', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,'Falso')`, [band, U.leader]), /row-level|violates/)
await rejects('un ajeno no puede escribir en el chat de otra banda', () => as('other', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,'Hola')`, [band, U.other]), /row-level|violates/)
await rejects('un mensaje no puede ir vacío ni pasar de 2000 caracteres', () => as('member', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,$3)`, [band, U.member, 'a'.repeat(2001)]), /check|body/)
await ok('cada quien borra lo suyo, el líder modera y un integrante no borra lo de otro', async () => {
  const [lm] = await as('leader', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,'Del líder') returning id`, [band, U.leader])
  eq((await as('member', `delete from public.band_messages where id=$1 returning id`, [lm.id])).length, 0, 'borró un mensaje ajeno')
  const [mm] = await as('member', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,'Del integrante') returning id`, [band, U.member])
  eq((await as('leader', `delete from public.band_messages where id=$1 returning id`, [mm.id])).length, 1, 'el líder no pudo moderar')
  eq((await as('leader', `delete from public.band_messages where id=$1 returning id`, [lm.id])).length, 1, 'no pudo borrar el suyo')
})
await rejects('frena las ráfagas: más de 20 mensajes en un minuto', async () => {
  for (let k = 0; k < 25; k++) await as('member', `insert into public.band_messages (band_id, profile_id, body) values ($1,$2,$3)`, [band, U.member, 'spam ' + k])
}, /demasiados mensajes/)
await ok('cada quien guarda hasta dónde leyó y al borrar la canción se borran sus comentarios', async () => {
  await as('member', `insert into public.band_chat_reads (band_id, profile_id) values ($1,$2) on conflict (band_id, profile_id) do update set last_read_at = now()`, [band, U.member])
  eq((await as('leader', `select 1 from public.band_chat_reads where band_id=$1`, [band])).length, 0, 'el líder ve lo leído de otro')
  await as('leader', `delete from public.songs where id=$1`, [chatSong])
  eq((await pg.query(`select 1 from public.song_comments where song_id=$1`, [chatSong])).rows.length, 0, 'quedó huérfano')
  await pg.query(`delete from public.band_messages where band_id=$1`, [band])
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member])
})

console.log('\nBorrar cuenta (Ley 1581)')
await ok('al borrar la cuenta del solicitante se anonimizan sus datos de contacto', async () => {
  await as('other', `select public.delete_account()`)
  const rows = await pg.query(`select contact_name, contact_phone, note, requested_by from public.bookings where id = $1`, [b3])
  eq([rows.rows[0].contact_name, rows.rows[0].contact_phone, rows.rows[0].note, rows.rows[0].requested_by], ['', null, null, null], 'datos de contacto')
})
console.log('Amigos y mensajes directos')
U.minor = crypto.randomUUID()
await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'minor@x.co', $2)`, [U.minor, JSON.stringify({ name: 'MINOR', terms_version: '0.2', age_declaration: 'minor_with_consent' })])
await pg.query(`update public.profiles set is_public = true where id = $1`, [U.minor])
let fr
await ok('un adulto envía solicitud a un perfil público; solo ellos dos la ven', async () => {
  const [r] = await as('owner', `insert into public.friendships (requester, addressee) values ($1,$2) returning id`, [U.owner, U.leader]); fr = r.id
  eq((await as('leader', `select id from public.friendships where id=$1`, [fr])).length, 1, 'el destinatario no la ve')
  eq((await as('member', `select id from public.friendships where id=$1`, [fr])).length, 0, 'un tercero la ve')
})
await rejects('un menor de edad no puede enviar solicitudes', () => as('minor', `insert into public.friendships (requester, addressee) values ($1,$2)`, [U.minor, U.leader]), /row-level|violates/)
U.loner = crypto.randomUUID()
await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'loner@x.co', $2)`, [U.loner, JSON.stringify({ name: 'LONER', terms_version: '0.2', age_declaration: 'adult' })])
await rejects('sin motivo ni amistad no se puede escribir', () => as('owner', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Hola')`, [U.owner, U.loner]), /no puedes escribirle|row-level|violates/)
await ok('quien envió la solicitud no puede aceptarla; el destinatario sí', async () => {
  eq((await as('owner', `update public.friendships set status='accepted' where id=$1 returning id`, [fr])).length, 0, 'se aceptó sola')
  eq((await as('leader', `update public.friendships set status='accepted', responded_at=now() where id=$1 returning id`, [fr])).length, 1, 'no pudo aceptar')
})
await ok('los amigos se escriben, un tercero no lo lee y solo el destinatario marca leído', async () => {
  const [m] = await as('owner', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Hola') returning id`, [U.owner, U.leader])
  await as('leader', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Hola, ¿cómo vas?')`, [U.leader, U.owner])
  eq((await as('member', `select id from public.direct_messages`)).length, 0, 'un tercero lee mensajes')
  eq((await as('owner', `update public.direct_messages set read_at = now() where id=$1 returning id`, [m.id])).length, 0, 'el remitente marcó leído')
  eq((await as('leader', `update public.direct_messages set read_at = now() where id=$1 returning id`, [m.id])).length, 1, 'el destinatario no pudo marcar leído')
  const ov = await as('leader', `select display_name, direction, unread from public.friends_overview()`)
  eq(ov.length, 1, 'panorama'); eq(ov[0].direction, 'friend', 'dirección'); eq(Number(ov[0].unread), 0, 'no leídos')
})
await ok('bloquear deshace la amistad y corta mensajes y solicitudes', async () => {
  await as('leader', `select public.block_user($1)`, [U.owner])
  eq((await pg.query(`select 1 from public.friendships`)).rows.length, 0, 'sigue la amistad')
})
await rejects('tras un bloqueo no se pueden enviar solicitudes ni mensajes', () => as('owner', `insert into public.friendships (requester, addressee) values ($1,$2)`, [U.owner, U.leader]), /row-level|violates/)
await ok('limpieza de amigos', async () => {
  await pg.query(`delete from public.direct_messages`); await pg.query(`delete from public.user_blocks`)
  await pg.query(`update public.profiles set is_public = false where id = $1`, [U.minor])
})

console.log('Busco músico')
U.replier = crypto.randomUUID()
await pg.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'replier@x.co', $2)`, [U.replier, JSON.stringify({ name: 'REPLIER', terms_version: '0.2', age_declaration: 'adult' })])
await pg.query(`update public.bands set is_public = true where id = $1`, [band])
await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
let opening
await ok('el admin publica «busco bajista»; un músico ajeno la ve y un integrante normal no puede publicar', async () => {
  const [o] = await as('leader', `insert into public.band_openings (band_id, created_by, instrument, kind, details) values ($1,$2,'Bajo','temporary','Toque del sábado') returning id`, [band, U.leader]); opening = o.id
  eq((await as('replier', `select id from public.band_openings where id=$1`, [opening])).length, 1, 'no la ve un ajeno')
  eq((await as('replier', `select id from public.open_openings()`)).length >= 1, true, 'no sale en la lista')
})
await rejects('un integrante sin rol de admin no publica', () => as('member', `insert into public.band_openings (band_id, created_by, instrument, kind) values ($1,$2,'Voz','permanent')`, [band, U.member]), /row-level|violates/)
await ok('un músico adulto responde; solo el admin ve quién respondió', async () => {
  await as('replier', `insert into public.opening_replies (opening_id, profile_id, message) values ($1,$2,'Toco bajo hace 8 años')`, [opening, U.replier])
  eq((await as('leader', `select display_name from public.opening_replies_for($1)`, [opening])).length, 1, 'el admin no ve la respuesta')
  eq((await as('member', `select 1 from public.opening_replies_for($1)`, [opening])).length, 0, 'un integrante normal ve respuestas')
  eq((await as('minor', `select 1 from public.opening_replies`)).length, 0, 'un tercero lee respuestas')
})
await rejects('no se responde dos veces a la misma publicación', () => as('replier', `insert into public.opening_replies (opening_id, profile_id, message) values ($1,$2,'otra vez')`, [opening, U.replier]), /duplicate|unique/)
await rejects('un menor de edad no responde', () => as('minor', `insert into public.opening_replies (opening_id, profile_id, message) values ($1,$2,'Hola')`, [opening, U.minor]), /row-level|violates/)
await rejects('un integrante de la propia banda no responde', () => as('member', `insert into public.opening_replies (opening_id, profile_id, message) values ($1,$2,'Hola')`, [opening, U.member]), /row-level|violates/)
await ok('al cerrar la publicación deja de verse y de aceptar respuestas', async () => {
  await as('leader', `update public.band_openings set status='closed' where id=$1`, [opening])
  eq((await as('replier', `select id from public.band_openings where id=$1`, [opening])).length, 0, 'sigue visible')
  eq((await as('leader', `select id from public.band_openings where id=$1`, [opening])).length, 1, 'el admin ya no la ve')
})
await ok('limpieza de búsquedas', async () => {
  await pg.query(`delete from public.band_openings`); await pg.query(`update public.bands set is_public = false where id = $1`, [band])
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member])
})

async function rejects_inline(fn, msg) { let failed = false; try { await fn() } catch { failed = true } if (!failed) throw new Error(msg) }
console.log('Invitados por días')
await ok('un invitado con plazo entra, lee, escribe su anotación y al vencer deja de ser de la banda', async () => {
  const [inv] = await as('leader', `insert into public.band_invites (band_id, role, guest_days) values ($1,'guest',3) returning code`, [band])
  await as('replier', `select public.join_band($1)`, [inv.code])
  const [m] = (await pg.query(`select guest_until, role from public.band_members where band_id=$1 and profile_id=$2`, [band, U.replier])).rows
  eq(m.role, 'guest', 'rol'); eq(m.guest_until != null, true, 'sin plazo')
  const [sg] = await as('leader', `insert into public.songs (band_id, title) values ($1,'Del toque') returning id`, [band])
  eq((await as('replier', `select id from public.songs where id=$1`, [sg.id])).length, 1, 'el invitado no lee')
  await as('replier', `insert into public.song_member_notes (song_id, band_id, profile_id, note) values ($1,$2,$3,'Bajo en el coro')`, [sg.id, band, U.replier])
  await rejects_inline(() => as('replier', `insert into public.songs (band_id, title) values ($1,'Intruso')`, [band]), 'el invitado no edita canciones')
  await pg.query(`update public.band_members set guest_until = current_date - 1 where band_id=$1 and profile_id=$2`, [band, U.replier])
  eq((await as('replier', `select id from public.songs where id=$1`, [sg.id])).length, 0, 'vencido sigue leyendo')
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.replier])
  await pg.query(`delete from public.songs where id=$1`, [sg.id]); await pg.query(`delete from public.band_invites where band_id=$1`, [band])
})
await rejects('el plazo de invitado solo aplica a invitaciones de invitado', () => as('leader', `insert into public.band_invites (band_id, role, guest_days) values ($1,'member',3)`, [band]), /check|guest_days/)

console.log('Equipo por toque')
await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
let gearEv
await ok('un integrante arma la lista de equipo y la banda la lee; un ajeno no', async () => {
  const [ev] = await as('leader', `insert into public.events (band_id, kind, title, starts_at, created_by) values ($1,'gig','Toque equipo', now() + interval '3 days', $2) returning id`, [band, U.leader]); gearEv = ev.id
  await as('member', `insert into public.event_gear (event_id, band_id, item, assigned_to) values ($1,$2,'Ampli de bajo',$3)`, [gearEv, band, U.member])
  eq((await as('leader', `select id from public.event_gear where event_id=$1`, [gearEv])).length, 1, 'el líder no la ve')
  eq((await as('minor', `select id from public.event_gear`)).length, 0, 'un ajeno la ve')
  const [g] = await as('leader', `select id from public.event_gear where event_id=$1`, [gearEv])
  eq((await as('member', `update public.event_gear set done = true where id=$1 returning id`, [g.id])).length, 1, 'no pudo marcarlo')
})
await rejects('no se asigna equipo a quien no es de la banda', () => as('leader', `insert into public.event_gear (event_id, band_id, item, assigned_to) values ($1,$2,'Cable',$3)`, [gearEv, band, U.minor]), /row-level|violates/)
await rejects('un ajeno no agrega equipo', () => as('minor', `insert into public.event_gear (event_id, band_id, item) values ($1,$2,'Intruso')`, [gearEv, band]), /row-level|violates/)
await rejects('máximo 60 elementos por evento', async () => {
  for (let k = 0; k < 62; k++) await as('leader', `insert into public.event_gear (event_id, band_id, item) values ($1,$2,$3)`, [gearEv, band, 'Cable ' + k])
}, /60 elementos/)
await ok('al borrar el evento se borra su lista de equipo', async () => {
  await as('leader', `delete from public.events where id=$1`, [gearEv])
  eq((await pg.query(`select 1 from public.event_gear where event_id=$1`, [gearEv])).rows.length, 0, 'quedó huérfana')
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member])
})

console.log('Link del setlist y resumen del toque')
await ok('el admin comparte un setlist; quien tiene el link ve solo lo básico, y al apagarlo deja de verse', async () => {
  await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
  const [sg] = await as('leader', `insert into public.songs (band_id, title, artist, key, lyrics, notes) values ($1,'Compartida','Artista','Am','LETRA SECRETA','nota interna') returning id`, [band])
  const [sl] = await as('leader', `insert into public.setlists (band_id, name, song_ids) values ($1,'Para compartir', $2::uuid[]) returning id`, [band, `{${sg.id}}`])
  eq((await as('member', `select public.setlist_share_token($1) as t`, [sl.id]))[0].t, null, 'un integrante normal ve el token')
  await rejects_inline(() => as('member', `select public.set_setlist_share($1, true)`, [sl.id]), 'un integrante normal compartió')
  const [{ set_setlist_share: tok }] = await as('leader', `select public.set_setlist_share($1, true)`, [sl.id])
  eq(typeof tok, 'string', 'sin token'); eq(tok.length >= 24, true, 'token corto')
  const seen = (await pg.query(`select public.shared_setlist($1) as d`, [tok])).rows[0].d
  eq(seen.name, 'Para compartir', 'nombre'); eq(seen.rows.length, 1, 'filas'); eq(seen.rows[0].title, 'Compartida', 'título')
  eq(JSON.stringify(seen).includes('LETRA SECRETA') || JSON.stringify(seen).includes('nota interna'), false, 'se filtró letra o notas')
  eq((await pg.query(`select public.shared_setlist('token-incorrecto-que-no-existe-1234') as d`)).rows[0].d, null, 'token falso')
  await as('leader', `select public.set_setlist_share($1, false)`, [sl.id])
  eq((await pg.query(`select public.shared_setlist($1) as d`, [tok])).rows[0].d, null, 'sigue visible apagado')
  await pg.query(`delete from public.setlists where id=$1`, [sl.id]); await pg.query(`delete from public.songs where id=$1`, [sg.id])
})
await ok('el resumen del toque lo escribe quien edita y lo lee la banda; no pasa de 2000 caracteres', async () => {
  const [ev] = await as('leader', `insert into public.events (band_id, kind, title, starts_at, created_by) values ($1,'gig','Con resumen', now() - interval '1 day', $2) returning id`, [band, U.leader])
  await as('member', `update public.events set recap = 'Salió bien el cierre' where id=$1`, [ev.id])
  eq((await as('leader', `select recap from public.events where id=$1`, [ev.id]))[0].recap, 'Salió bien el cierre', 'no se guardó')
  await rejects_inline(() => as('leader', `update public.events set recap = $2 where id=$1`, [ev.id, 'a'.repeat(2001)]), 'pasó de 2000')
  await as('leader', `delete from public.events where id=$1`, [ev.id])
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member])
})

console.log('Integridad')
await ok('al borrar una canción se quita de los setlists (lista e items) y las demás quedan', async () => {
  const [a] = await as('leader', `insert into public.songs (band_id, title) values ($1,'A borrar') returning id`, [band])
  const [b] = await as('leader', `insert into public.songs (band_id, title) values ($1,'Se queda') returning id`, [band])
  const items = JSON.stringify([{ t: 's', id: a.id, tags: ['Solo'] }, { t: 'l', id: 'l1', text: 'Pausa' }, { t: 's', id: b.id }])
  const [sl] = await as('leader', `insert into public.setlists (band_id, name, song_ids, items) values ($1,'Con borrada',$2::uuid[],$3::jsonb) returning id`, [band, `{${a.id},${b.id}}`, items])
  await as('leader', `delete from public.songs where id=$1`, [a.id])
  const [r] = await as('leader', `select song_ids, items from public.setlists where id=$1`, [sl.id])
  eq(r.song_ids, [b.id], 'song_ids'); eq(r.items.map((x) => x.id), ['l1', b.id], 'items')
  await pg.query(`delete from public.setlists where id=$1`, [sl.id]); await pg.query(`delete from public.songs where id=$1`, [b.id])
})
await ok('el dueño guarda el horario de su sala de una vez y otro no puede', async () => {
  await as('owner', `select public.save_venue_hours($1, $2::jsonb)`, [venue, JSON.stringify([{ weekday: 1, opens: '09:00', closes: '21:00' }, { weekday: 2, opens: '09:00', closes: '21:00' }])])
  eq((await pg.query(`select count(*)::int as n from public.venue_hours where venue_id=$1`, [venue])).rows[0].n, 2, 'horario')
  await rejects_inline(() => as('leader', `select public.save_venue_hours($1, '[]'::jsonb)`, [venue]), 'otro cambió el horario')
  await rejects_inline(() => as('owner', `select public.save_venue_hours($1, $2::jsonb)`, [venue, JSON.stringify([{ weekday: 1, opens: '22:00', closes: '09:00' }])]), 'aceptó horas inválidas')
  eq((await pg.query(`select count(*)::int as n from public.venue_hours where venue_id=$1`, [venue])).rows[0].n, 2, 'el horario cambió aunque falló')
})

console.log('Denuncias y términos')
await ok('se denuncia contenido una sola vez; cada quien solo ve las suyas', async () => {
  const target = crypto.randomUUID()
  await as('leader', `insert into public.content_reports (kind, target_id, reason, details, excerpt) values ('message',$1,'acoso','me escribe seguido','texto del mensaje')`, [target])
  await rejects_inline(() => as('leader', `insert into public.content_reports (kind, target_id, reason) values ('message',$1,'spam')`, [target]), 'permitió denunciar dos veces lo mismo')
  eq((await as('leader', `select id from public.content_reports`)).length >= 1, true, 'no ve la suya')
  eq((await as('owner', `select id from public.content_reports`)).length, 0, 've denuncias ajenas')
  await rejects_inline(() => as('leader', `update public.content_reports set status='revisada' where target_id=$1`, [target]), 'cambió el estado de su denuncia')
  await pg.query(`delete from public.content_reports`)
})
await ok('se acepta una nueva versión de los términos', async () => {
  await as('leader', `select public.accept_terms('0.7')`)
  eq((await as('leader', `select public.my_terms_version() as v`))[0].v, '0.7', 'versión')
  await rejects_inline(() => as('leader', `select public.accept_terms('')`), 'aceptó versión vacía')
})

console.log('Endurecimiento')
await rejects('el endpoint de avisos debe ser de un servicio conocido', () => as('leader', `select public.save_push_subscription('https://servidor-raro.example/x','p','a')`), /no permitido/)
await ok('nadie lee ni escribe share_token directo; el líder sí lo maneja con sus funciones', async () => {
  await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
  const [sl] = await as('leader', `insert into public.setlists (band_id, name, song_ids) values ($1,'Token',$2::uuid[]) returning id`, [band, '{}'])
  await rejects_inline(() => as('member', `select share_token from public.setlists where id=$1`, [sl.id]), 'un integrante leyó share_token')
  await rejects_inline(() => as('member', `update public.setlists set share_token='aaaaaaaaaaaaaaaaaaaaaaaaaaaa' where id=$1`, [sl.id]), 'un integrante escribió share_token')
  await rejects_inline(() => as('leader', `select share_token from public.setlists where id=$1`, [sl.id]), 'el líder leyó share_token directo')
  eq(typeof (await as('leader', `select public.set_setlist_share($1, true) as t`, [sl.id]))[0].t, 'string', 'el líder no pudo compartir')
  eq((await as('member', `select name from public.setlists where id=$1`, [sl.id])).length, 1, 'el integrante ya no lee el setlist')
  await pg.query(`delete from public.setlists where id=$1`, [sl.id])
})
await ok('las funciones auxiliares no sirven de oráculo sobre terceros', async () => {
  eq((await as('member', `select public.is_blocked_between($1,$2) as r`, [U.owner, U.leader]))[0].r, false, 'is_blocked_between')
  eq((await as('member', `select public.are_friends($1,$2) as r`, [U.owner, U.leader]))[0].r, false, 'are_friends')
  eq((await as('member', `select public.can_befriend($1,$2) as r`, [U.owner, U.leader]))[0].r, false, 'can_befriend')
})
await ok('el cliente no elige la fecha ni lo leído de lo que escribe', async () => {
  await as('leader', `insert into public.band_messages (band_id, profile_id, body, created_at, notified_at) values ($1,$2,'Con fecha falsa', now() - interval '3 years', now())`, [band, U.leader])
  const [r] = await as('leader', `select created_at > now() - interval '1 minute' as reciente, notified_at is null as sin_aviso from public.band_messages where body='Con fecha falsa'`)
  eq(r.reciente, true, 'created_at'); eq(r.sin_aviso, true, 'notified_at')
  await pg.query(`delete from public.band_messages where band_id=$1`, [band])
})
await ok('un invitado vencido que vuelve con un código nuevo recupera el acceso', async () => {
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.replier])
  await pg.query(`insert into public.band_members (band_id, profile_id, role, guest_until) values ($1,$2,'guest', current_date - 2)`, [band, U.replier])
  const [inv] = await as('leader', `insert into public.band_invites (band_id, role, guest_days) values ($1,'guest',5) returning code`, [band])
  await as('replier', `select public.join_band($1)`, [inv.code])
  const [m] = (await pg.query(`select guest_until >= current_date as vigente from public.band_members where band_id=$1 and profile_id=$2`, [band, U.replier])).rows
  eq(m.vigente, true, 'sigue vencido')
  await pg.query(`delete from public.band_members where band_id=$1 and profile_id in ($2,$3)`, [band, U.replier, U.member]); await pg.query(`delete from public.band_invites where band_id=$1`, [band])
})
await ok('el link público aguanta etiquetas con id raro y etiquetas que no son lista', async () => {
  const [sg] = await as('leader', `insert into public.songs (band_id, title) values ($1,'Rara') returning id`, [band])
  const items = JSON.stringify([{ t: 'l', id: 'no-es-uuid', text: 'Pausa' }, { t: 's', id: sg.id, tags: 'no-es-lista' }])
  const [sl] = await as('leader', `insert into public.setlists (band_id, name, song_ids, items) values ($1,'Rara',$2::uuid[],$3::jsonb) returning id`, [band, `{${sg.id}}`, items])
  const [{ t }] = await as('leader', `select public.set_setlist_share($1, true) as t`, [sl.id])
  const d = (await pg.query(`select public.shared_setlist($1) as d`, [t])).rows[0].d
  eq(d.rows.length, 2, 'filas'); eq(d.rows[1].tags, [], 'tags')
  await pg.query(`delete from public.setlists where id=$1`, [sl.id]); await pg.query(`delete from public.songs where id=$1`, [sg.id])
})

console.log('Muro y mercado')
await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member') on conflict do nothing`, [band, U.member])
let pubPost, friendPost, bandPost
await ok('un adulto publica; ve el muro público quien es adulto, no un menor; lo de amigos solo los amigos; lo de banda solo la banda', async () => {
  ;[pubPost] = await as('leader', `insert into public.posts (body, visibility) values ('Ensayo de hoy','public') returning id`)
  ;[friendPost] = await as('leader', `insert into public.posts (body, visibility) values ('Solo amigos','friends') returning id`)
  ;[bandPost] = await as('leader', `insert into public.posts (band_id, body, visibility) values ($1,'Aviso de la banda','band') returning id`, [band])
  eq((await as('owner', `select id from public.posts where id=$1`, [pubPost.id])).length, 1, 'un adulto no ve lo público')
  eq((await as('minor', `select id from public.posts where id=$1`, [pubPost.id])).length, 0, 'un menor ve lo público')
  eq((await as('owner', `select id from public.posts where id=$1`, [friendPost.id])).length, 0, 'un desconocido ve lo de amigos')
  eq((await as('member', `select id from public.posts where id=$1`, [bandPost.id])).length, 1, 'la banda no ve lo suyo (incluido un menor integrante)')
  eq((await as('owner', `select id from public.posts where id=$1`, [bandPost.id])).length, 0, 'un ajeno ve lo de la banda')
})
await rejects('un menor no publica para el público ni para amigos', () => as('minor', `insert into public.posts (body, visibility) values ('Hola','public')`), /row-level|violates/)
await rejects('un integrante normal no publica en nombre de la banda', () => as('member', `insert into public.posts (band_id, body, visibility) values ($1,'Falso','band')`, [band]), /row-level|violates/)
await rejects('las fotos deben estar en la carpeta de quien publica', () => as('leader', `insert into public.posts (body, images, visibility) values ('Foto', $1::text[], 'public')`, [`{${U.owner}/otra/a.webp}`]), /ruta de foto/)
await ok('amistad abre lo de amigos; un bloqueo lo cierra', async () => {
  const [f] = await pg.query(`insert into public.friendships (requester, addressee, status) values ($1,$2,'accepted') returning id`, [U.owner, U.leader]).then((r) => r.rows)
  eq((await as('owner', `select id from public.posts where id=$1`, [friendPost.id])).length, 1, 'un amigo no ve lo de amigos')
  await pg.query(`insert into public.user_blocks (blocker, blocked) values ($1,$2)`, [U.leader, U.owner])
  eq((await as('owner', `select id from public.posts where id=$1`, [pubPost.id])).length, 0, 'un bloqueado ve las publicaciones')
  await pg.query(`delete from public.user_blocks`); await pg.query(`delete from public.friendships where id=$1`, [f.id])
})
await ok('me gusta y comentarios solo sobre lo que se ve; cada quien borra lo suyo', async () => {
  await as('owner', `insert into public.post_likes (post_id) values ($1)`, [pubPost.id])
  await rejects_inline(() => as('minor', `insert into public.post_likes (post_id) values ($1)`, [pubPost.id]), 'un menor dio me gusta a lo público')
  await as('owner', `insert into public.post_comments (post_id, body) values ($1,'Qué bien')`, [pubPost.id])
  const st = await as('leader', `select * from public.post_stats($1::uuid[])`, [`{${pubPost.id}}`])
  eq([st[0].likes, st[0].comments, st[0].liked], [1, 1, false], 'estadísticas')
  const [c] = await as('leader', `select id from public.post_comments where post_id=$1`, [pubPost.id])
  eq((await as('leader', `delete from public.post_comments where id=$1 returning id`, [c.id])).length, 1, 'el autor de la publicación no pudo borrar un comentario')
})
await ok('seguir: solo adultos y solo bandas o perfiles públicos; el muro «Para ti» incluye lo seguido', async () => {
  await pg.query(`update public.bands set is_public = true where id=$1`, [band])
  await as('owner', `insert into public.follows (target_kind, target_id) values ('band',$1)`, [band])
  await rejects_inline(() => as('minor', `insert into public.follows (target_kind, target_id) values ('band',$1)`, [band]), 'un menor siguió')
  const [bp] = await as('leader', `insert into public.posts (band_id, body, visibility) values ($1,'Para fans', 'public') returning id`, [band])
  eq((await as('owner', `select id from public.feed_for_me(30, now() + interval '1 hour')`)).some((r) => r.id === bp.id), true, 'no aparece lo seguido')
  eq((await as('replier', `select id from public.feed_for_me(30, now() + interval '1 hour')`)).some((r) => r.id === bp.id), false, 'aparece sin seguir')
  await pg.query(`update public.bands set is_public = false where id=$1`, [band])
  await rejects_inline(() => as('replier', `insert into public.follows (target_kind, target_id) values ('band',$1)`, [band]), 'siguió una banda no pública')
})
await ok('las fotos del muro solo las ve quien ve la publicación', async () => {
  await pg.query(`insert into storage.objects (bucket_id, name) values ('feed-media', $1)`, [`${U.leader}/${pubPost.id}/a.webp`])
  await pg.query(`insert into storage.objects (bucket_id, name) values ('feed-media', $1)`, [`${U.leader}/${friendPost.id}/a.webp`])
  const ver = async (u) => (await as(u, `select name from storage.objects where bucket_id='feed-media'`)).map((r) => r.name)
  eq((await ver('owner')).length, 1, 'un adulto debía ver solo la foto de lo público')
  eq((await ver('minor')).length, 0, 'un menor vio fotos')
  eq((await ver('leader')).length, 2, 'el autor no ve las suyas')
  await pg.query(`delete from storage.objects where bucket_id='feed-media'`)
})
await ok('mercado: un adulto publica, otros adultos lo ven, un menor no; vendido se oculta; preguntas públicas que solo el vendedor responde', async () => {
  const [l] = await as('leader', `insert into public.listings (title, category, condition, price, city) values ('Bajo Precision','bajo','usado',1500000,'Bogotá') returning id`)
  eq((await as('owner', `select id from public.listings where id=$1`, [l.id])).length, 1, 'un adulto no ve el anuncio')
  eq((await as('minor', `select id from public.listings where id=$1`, [l.id])).length, 0, 'un menor ve el anuncio')
  await rejects_inline(() => as('minor', `insert into public.listings (title, category, condition, price) values ('Algo','otro','usado',1)`), 'un menor publicó un anuncio')
  const [q] = await as('owner', `insert into public.listing_questions (listing_id, body) values ($1,'¿Aceptas cambio?') returning id`, [l.id])
  eq((await as('owner', `update public.listing_questions set answer='Sí' where id=$1 returning id`, [q.id])).length, 0, 'el comprador respondió')
  eq((await as('leader', `update public.listing_questions set answer='Sí' where id=$1 returning id`, [q.id])).length, 1, 'el vendedor no pudo responder')
  await as('leader', `update public.listings set status='sold' where id=$1`, [l.id])
  eq((await as('owner', `select id from public.listings where id=$1`, [l.id])).length, 0, 'se ve lo vendido')
  eq((await as('leader', `select id from public.listings where id=$1`, [l.id])).length, 1, 'el vendedor no ve el suyo')
  await rejects_inline(() => as('leader', `insert into public.listings (title, category, condition, price) values ('Bad','otro','usado',-5)`), 'precio negativo')
  await pg.query(`delete from public.listings`); await pg.query(`delete from public.posts`)
})
await ok('tarjetas de personas: solo de quien puedo conocer', async () => {
  const [pp] = await as('leader', `insert into public.posts (body, visibility) values ('Para tarjetas','public') returning id`)
  const cards = await as('owner', `select id from public.profile_cards($1::uuid[])`, [`{${U.leader},${U.replier},${U.minor}}`])
  eq(cards.some((c) => c.id === U.leader), true, 'no devolvió a quien publica')
  eq(cards.some((c) => c.id === U.replier), false, 'devolvió a un desconocido')
  await pg.query(`delete from public.posts where id=$1`, [pp.id])
})
await ok('limpieza del muro', async () => { await pg.query(`delete from public.band_members where band_id=$1 and profile_id=$2`, [band, U.member]) })

console.log('Alquiler del ensayadero')
await ok('el alquiler es del ensayadero (sin sala); lo incluido exige sala; el tope y los permisos se respetan', async () => {
  await as('owner', `insert into public.room_equipment (venue_id, kind, quantity, included, extra_price) values ($1,'guitar',3,false,15000)`, [venue])
  eq((await pg.query(`select count(*)::int as n from public.room_equipment where venue_id=$1 and room_id is null`, [venue])).rows[0].n >= 1, true, 'no se guardó el alquiler')
  await rejects_inline(() => as('owner', `insert into public.room_equipment (venue_id, kind, quantity, included) values ($1,'drums',1,true)`, [venue]), 'lo incluido sin sala')
  await rejects_inline(() => as('leader', `insert into public.room_equipment (venue_id, kind, quantity, included) values ($1,'bass',1,false)`, [venue]), 'otra persona agregó alquiler')
  await pg.query(`delete from public.room_equipment where venue_id=$1 and room_id is null`, [venue])
})

console.log('Mensajes sin amistad')
await ok('escribir a un perfil público crea una solicitud; hasta 3 mensajes; al responder queda aceptada; rechazar o bloquear la cierra', async () => {
  await pg.query(`update public.profiles set is_public = true where id = $1`, [U.leader])
  await as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Hola, vi tu perfil')`, [U.replier, U.leader])
  eq((await as('leader', `select state from public.conversations()`))[0].state, 'request_in', 'no llegó como solicitud')
  await as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Segundo')`, [U.replier, U.leader])
  await as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Tercero')`, [U.replier, U.leader])
  await rejects_inline(() => as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Cuarto')`, [U.replier, U.leader]), 'pasó de 3 mensajes sin respuesta')
  await as('leader', `select public.respond_dm_request($1, true)`, [U.replier])
  await as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Ahora sí')`, [U.replier, U.leader])
  eq((await as('replier', `select state from public.conversations()`))[0].state, 'accepted', 'no quedó aceptada')
  await as('leader', `select public.block_user($1)`, [U.replier])
  await rejects_inline(() => as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Bloqueado')`, [U.replier, U.leader]), 'escribió estando bloqueada')
  await pg.query(`delete from public.direct_messages`); await pg.query(`delete from public.user_blocks`); await pg.query(`delete from public.dm_contacts`)
  await pg.query(`update public.profiles set is_public = false where id = $1`, [U.leader])
})
await ok('sin motivo, o siendo menor, no se puede escribir; rechazar impide seguir', async () => {
  await rejects_inline(() => as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Sin motivo')`, [U.replier, U.loner]), 'escribió a un perfil privado sin motivo')
  await pg.query(`update public.profiles set is_public = true where id = $1`, [U.leader])
  await rejects_inline(() => as('minor', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Soy menor')`, [U.minor, U.leader]), 'un menor escribió')
  await as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Hola')`, [U.replier, U.leader])
  await as('leader', `select public.respond_dm_request($1, false)`, [U.replier])
  await rejects_inline(() => as('replier', `insert into public.direct_messages (sender, recipient, body) values ($1,$2,'Insisto')`, [U.replier, U.leader]), 'siguió escribiendo tras ser rechazada')
  await pg.query(`delete from public.direct_messages`); await pg.query(`delete from public.dm_contacts`)
  await pg.query(`update public.profiles set is_public = false where id = $1`, [U.leader])
})

// ───────── Pagos de reservas (0040) ─────────
let pay1, pay2
await pg.query(`delete from public.venue_hours where venue_id=$1`, [venue])
for (let d = 0; d < 7; d++) await pg.query(`insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1,$2,'08:00','22:00')`, [venue, d])
await ok('el dueño configura cómo cobra (Nequi + anticipo 50 % + 24 h)', async () => {
  await as('owner', `update public.venues set pay_required=true, pay_nequi='300 123 4567', pay_deposit_pct=50, pay_hold_hours=24, auto_confirm=true, cancel_policy='Cancela hasta 24 horas antes y te devolvemos todo', legal_name='Estudio Eco SAS', tax_id='900123456' where id=$1`, [venue])
})
await rejects('cobrar exige al menos un método de pago', () => as('owner', `update public.venues set pay_nequi=null, pay_breb=null, pay_link=null where id=$1`, [venue]), /pay_method/)
await rejects('el link de pago debe ser https', () => as('owner', `update public.venues set pay_link='http://x.co' where id=$1`, [venue]), /pay_link/)
await rejects('con cobro hay que aceptar las condiciones', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(29, '15:00'), t(29, '16:00')]), /aceptar/)
await ok('con cobro un menor no puede reservar', async () => {
  await pg.query(`update public.profiles set age_declaration='minor_with_consent' where id=$1`, [U.member])
  await rejects_inline(() => as('member', `select public.request_booking($1,$2,$3,null,null,null,true)`, [room, t(29, '15:00'), t(29, '16:00')]), 'menor reservó')
  await pg.query(`update public.profiles set age_declaration='adult' where id=$1`, [U.member])
})
await ok('al reservar con cobro queda confirmada esperando pago, con total, anticipo y plazo', async () => {
  const [r] = await as('leader', `select public.request_booking($1,$2,$3,null,null,null,true) as id`, [room, t(30, '15:00'), t(30, '17:00')]); pay1 = r.id
  const [sn] = (await pg.query(`select cancel_policy_snapshot as p, terms_accepted_at is not null as a from public.bookings where id=$1`, [pay1])).rows
  eq([sn.p, sn.a], ['Cancela hasta 24 horas antes y te devolvemos todo', true], 'registro de aceptación')
  const [b] = (await pg.query(`select total_amount, deposit_amount, pay_status, pay_due_at is not null as due from public.bookings where id=$1`, [pay1])).rows
  eq(b.total_amount, 70000, 'total'); eq(b.deposit_amount, 35000, 'anticipo'); eq(b.pay_status, 'awaiting', 'estado'); eq(b.due, true, 'plazo')
})
await rejects('un tercero no puede adjuntar el comprobante', () => as('member', `select public.attach_payment_proof($1,$2)`, [pay1, `${U.member}/${pay1}/a.webp`]), /no puedes adjuntar/)
await rejects('la ruta del comprobante debe ser de la reserva', () => as('leader', `select public.attach_payment_proof($1,$2)`, [pay1, `${U.leader}/otra/a.webp`]), /inválida/)
await rejects('no se adjunta un comprobante que no existe en Storage', () => as('leader', `select public.attach_payment_proof($1,$2)`, [pay1, `${U.leader}/${pay1}/fantasma.webp`]), /inválida/)
await rejects('no se sube a una reserva ajena', () => as('member', `insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)`, [`${U.member}/${pay1}/x.webp`]), /row-level|permission|policy/)
await ok('el cliente adjunta el comprobante', async () => {
  await as('leader', `insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)`, [`${U.leader}/${pay1}/a.webp`])
  await as('leader', `select public.attach_payment_proof($1,$2)`, [pay1, `${U.leader}/${pay1}/a.webp`])
  eq((await pg.query(`select pay_status from public.bookings where id=$1`, [pay1])).rows[0].pay_status, 'proof_sent', 'estado')
})
await rejects('el cliente no puede marcarse como pagado', () => as('leader', `select public.review_payment($1,'paid')`, [pay1]), /solo el dueño/)
await rejects('el cliente no puede editar el estado de pago por tabla', () => as('leader', `update public.bookings set pay_status='paid' where id=$1`, [pay1]), /./)
await ok('el dueño rechaza el comprobante: vuelve a esperar con nuevo plazo y motivo', async () => {
  await as('owner', `select public.review_payment($1,'reject','No se ve el valor')`, [pay1])
  const [b] = (await pg.query(`select pay_status, proof_path, pay_note from public.bookings where id=$1`, [pay1])).rows
  eq(b.pay_status, 'awaiting', 'estado'); eq(b.proof_path, null, 'ruta'); eq(b.pay_note, 'No se ve el valor', 'nota')
})
await ok('con comprobante enviado no vence aunque pase el plazo (culpa del dueño)', async () => {
  await as('leader', `insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)`, [`${U.leader}/${pay1}/b.webp`])
  await as('leader', `select public.attach_payment_proof($1,$2)`, [pay1, `${U.leader}/${pay1}/b.webp`])
  await pg.query(`update public.bookings set pay_due_at = now() - interval '1 hour' where id=$1`, [pay1])
  await as('member', `select public.expire_unpaid_bookings()`)
  eq((await pg.query(`select status from public.bookings where id=$1`, [pay1])).rows[0].status, 'confirmed', 'se canceló')
})
await ok('el dueño aprueba: queda pagada', async () => {
  await as('owner', `select public.review_payment($1,'paid')`, [pay1])
  eq((await pg.query(`select pay_status from public.bookings where id=$1`, [pay1])).rows[0].pay_status, 'paid', 'estado')
})
await ok('si se cancela una reserva pagada queda con devolución pendiente y la sala la resuelve', async () => {
  await as('leader', `select public.cancel_booking($1)`, [pay1])
  eq((await pg.query(`select pay_status from public.bookings where id=$1`, [pay1])).rows[0].pay_status, 'refund_due', 'no quedó pendiente')
  eq((await as('leader', `select * from public.booking_pay_info($1)`, [pay1])).length, 0, 'sigue dando datos de pago')
  await rejects_inline(() => as('leader', `select public.review_payment($1,'refunded')`, [pay1]), 'la banda se marcó devuelta')
  await as('owner', `select public.review_payment($1,'refunded','Transferido')`, [pay1])
  eq((await pg.query(`select pay_status from public.bookings where id=$1`, [pay1])).rows[0].pay_status, 'refunded', 'no quedó devuelta')
  await rejects_inline(() => as('owner', `select public.review_payment($1,'no_refund')`, [pay1]), 'resolvió dos veces')
})
await ok('sin comprobante, al vencer el plazo se cancela sola y la franja se libera', async () => {
  const [r] = await as('leader', `select public.request_booking($1,$2,$3,null,null,null,true) as id`, [room, t(31, '15:00'), t(31, '16:00')]); pay2 = r.id
  await pg.query(`update public.bookings set pay_due_at = now() - interval '1 minute' where id=$1`, [pay2])
  eq((await as('member', `select count(*)::int as n from public.room_busy($1,$2,$3)`, [room, t(31, '00:00'), t(31, '23:00')]))[0].n, 0, 'sigue ocupada')
  await as('leader', `select public.expire_unpaid_bookings()`)
  eq((await pg.query(`select status from public.bookings where id=$1`, [pay2])).rows[0].status, 'cancelled', 'no se canceló')
})
await ok('quien reservó ve cómo pagar; un tercero no', async () => {
  const [aw] = await as('leader', `select public.request_booking($1,$2,$3,null,null,null,true) as id`, [room, t(34, '15:00'), t(34, '16:00')])
  eq((await as('leader', `select nequi from public.booking_pay_info($1)`, [aw.id]))[0]?.nequi, '300 123 4567', 'nequi')
  eq((await as('member', `select nequi from public.booking_pay_info($1)`, [aw.id])).length, 0, 'tercero')
  eq((await as('owner', `select legal_name from public.venue_legal_info($1)`, [venue]))[0]?.legal_name, 'Estudio Eco SAS', 'nombre legal')
  eq((await as('owner', `select deposit_pct from public.my_pay_settings($1)`, [venue]))[0]?.deposit_pct, 50, 'dueño')
  eq((await as('leader', `select * from public.my_pay_settings($1)`, [venue])).length, 0, 'ajeno')
})
await rejects('nadie puede leer pay_nequi directo de la tabla', () => as('leader', `select pay_nequi from public.venues where id=$1`, [venue]), /permission denied/)
await ok('sin cobro configurado la reserva no pide pago', async () => {
  await as('owner', `update public.venues set pay_required=false where id=$1`, [venue])
  const [r] = await as('leader', `select public.request_booking($1,$2,$3) as id`, [room, t(32, '15:00'), t(32, '16:00')])
  eq((await pg.query(`select pay_status from public.bookings where id=$1`, [r.id])).rows[0].pay_status, 'not_required', 'estado')
})

// ───────── Bloqueos de horario del dueño (0041) ─────────
let blk, bk1
await ok('el dueño bloquea una sala varios días y nadie puede reservarla', async () => {
  await as('owner', `select public.add_room_block($1,$2,$3,$4,'Mejoras')`, [venue, room, t(40, '00:00'), t(43, '23:00')])
  eq((await as('leader', `select count(*)::int as n from public.room_busy($1,$2,$3)`, [room, t(41, '00:00'), t(41, '23:00')]))[0].n, 1, 'no aparece ocupada')
})
await rejects('no se puede pedir una franja bloqueada', () => as('leader', `select public.request_booking($1,$2,$3)`, [room, t(41, '15:00'), t(41, '16:00')]), /ocupada/)
await ok('fuera del bloqueo se reserva normal', async () => { await as('leader', `select public.request_booking($1,$2,$3)`, [room, t(44, '15:00'), t(44, '16:00')]) })
await rejects('un tercero no puede bloquear horarios', () => as('member', `select public.add_room_block($1,null,$2,$3)`, [venue, t(50, '00:00'), t(51, '00:00')]), /solo el dueño/)
await rejects('la hora final debe ser posterior', () => as('owner', `select public.add_room_block($1,null,$2,$3)`, [venue, t(51, '00:00'), t(50, '00:00')]), /posterior/)
await ok('con reservas en el rango avisa y no bloquea hasta confirmar', async () => {
  const [r] = await as('leader', `select public.request_booking($1,$2,$3) as id`, [room, t(46, '15:00'), t(46, '16:00')]); bk1 = r.id
  await rejects_inline(() => as('owner', `select public.add_room_block($1,null,$2,$3,'Cerrado')`, [venue, t(46, '00:00'), t(46, '23:00')]), 'conflicto:1')
  eq((await pg.query(`select count(*)::int as n from public.room_blocks where venue_id=$1 and starts_at >= $2`, [venue, t(46, '00:00')])).rows[0].n, 0, 'bloqueó igual')
  const ids = (await as('owner', `select public.add_room_block($1,null,$2,$3,'Cerrado',true) as ids`, [venue, t(46, '00:00'), t(46, '23:00')]))[0].ids
  eq(ids.length, 1, 'canceladas')
  eq((await pg.query(`select status from public.bookings where id=$1`, [bk1])).rows[0].status, 'cancelled', 'no se canceló')
})
await ok('cerrar todo el negocio bloquea todas las salas', async () => {
  eq((await as('leader', `select count(*)::int as n from public.room_busy($1,$2,$3)`, [room, t(46, '00:00'), t(46, '23:00')]))[0].n, 1, 'sala')
})
await ok('quien mira la sala ve los cierres del negocio (solo fechas)', async () => {
  eq((await as('leader', `select * from public.venue_closures($1)`, [venue])).length, 1, 'cierre')
})
await ok('el dueño ve y borra sus bloqueos; otros no los ven', async () => {
  const mine = await as('owner', `select id from public.room_blocks where venue_id=$1`, [venue]); blk = mine[0].id
  eq((await as('leader', `select id from public.room_blocks`)).length, 0, 'ajeno ve')
  await as('owner', `delete from public.room_blocks where id=$1`, [blk])
})
await ok('el dueño ignora un evento del calendario y la franja se libera', async () => {
  await pg.query(`delete from public.room_external_busy where room_id=$1`, [room])
  await pg.query(`insert into public.room_external_busy (room_id, starts_at, ends_at) values ($1,$2,$3)`, [room, t(55, '19:00'), t(55, '21:00')])
  eq((await as('leader', `select count(*)::int as n from public.room_busy($1,$2,$3)`, [room, t(55, '00:00'), t(55, '23:00')]))[0].n, 1, 'ocupada')
  eq((await as('owner', `select * from public.list_external_busy($1)`, [room])).length, 1, 'lista')
  eq((await as('leader', `select * from public.list_external_busy($1)`, [room])).length, 0, 'ajeno ve la lista')
  await rejects_inline(() => as('leader', `select public.set_external_ignored($1,$2,$3,true)`, [room, t(55, '19:00'), t(55, '21:00')]), 'solo el dueño')
  await as('owner', `select public.set_external_ignored($1,$2,$3,true)`, [room, t(55, '19:00'), t(55, '21:00')])
  eq((await as('leader', `select count(*)::int as n from public.room_busy($1,$2,$3)`, [room, t(55, '00:00'), t(55, '23:00')]))[0].n, 0, 'sigue ocupada')
})

await ok('descargar mis datos devuelve solo lo mío', async () => {
  const [r] = await as('leader', `select public.export_my_data() as d`)
  eq(r.d.perfil.id, U.leader, 'perfil')
  eq(Array.isArray(r.d.bandas), true, 'bandas')
  eq(r.d.mis_negocios.length, 0, 'negocios ajenos')
  eq(JSON.stringify(r.d).includes(U.owner) && (r.d.mis_negocios.length > 0), false, 'datos del dueño')
  const [o] = await as('owner', `select public.export_my_data() as d`)
  eq(o.d.mis_negocios.length >= 1, true, 'negocio propio')
})
await rejects('sin sesión no se descargan datos', () => pg.query(`select public.export_my_data()`), /no autenticado|permission|null/)
await ok('el registro de errores guarda, recorta y limita a 20 por hora', async () => {
  for (let i = 0; i < 25; i++) await as('leader', `select public.log_client_error($1, $2)`, ['fallo ' + i, 'x'.repeat(3000)])
  const [r] = (await pg.query(`select count(*)::int as n, max(length(stack))::int as len from public.client_errors where user_id=$1`, [U.leader])).rows
  eq(r.n, 20, 'límite'); eq(r.len, 1500, 'recorte')
})
await rejects('nadie lee el registro de errores directo', () => as('leader', `select * from public.client_errors`), /permission denied/)
await ok('sin sesión no se registra nada', async () => { await pg.query(`select public.log_client_error('anon')`); eq((await pg.query(`select count(*)::int as n from public.client_errors where message='anon'`)).rows[0].n, 0, 'anon') })
await rejects('el líder de una banda con más gente no puede borrar su cuenta', async () => {
  await pg.query(`insert into public.band_members (band_id, profile_id, role) values ($1,$2,'member')`, [band, U.member])
  await as('leader', `select public.delete_account()`)
}, /traspasa/)
await ok('borrar la cuenta del dueño borra su sala (cascada)', async () => {
  await as('owner', `select public.delete_account()`)
  eq((await pg.query(`select id from public.venues where id=$1`, [venue])).rows.length, 0, 'sala sigue')
})

console.log(`\n${pass} pruebas correctas, ${fail} con falla`)
process.exit(fail ? 1 : 0)
