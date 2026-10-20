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
  await as('leader', `select public.save_push_subscription('https://push.example/abc','p256','auth','Chrome')`)
  eq((await as('leader', `select endpoint from public.push_subscriptions`)).length, 1, 'propias')
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 0, 'ajenas')
})
await rejects('no se pueden insertar suscripciones directo (ni a nombre de otro)', () => as('owner', `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,'https://x.example/1','a','b')`, [U.leader]), /permission denied/)
await rejects('el endpoint debe ser https', () => as('leader', `select public.save_push_subscription('http://push.example/x','p','a')`), /check/)
await ok('si el dispositivo cambia de cuenta, la suscripción pasa a la cuenta actual', async () => {
  await as('owner', `select public.save_push_subscription('https://push.example/abc','p256b','authb','Chrome')`)
  eq((await as('leader', `select endpoint from public.push_subscriptions`)).length, 0, 'sigue en la anterior')
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 1, 'no pasó a la nueva')
})
await ok('cada quien puede borrar la suya, no la ajena', async () => {
  await as('leader', `delete from public.push_subscriptions`)
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 1, 'borró la de otro')
  await as('owner', `delete from public.push_subscriptions`)
  eq((await as('owner', `select endpoint from public.push_subscriptions`)).length, 0, 'no borró la propia')
})
await rejects('máximo 10 dispositivos por persona', async () => { for (let i = 0; i < 11; i++) await as('member', `select public.save_push_subscription($1,'p','a')`, [`https://push.example/m${i}`]) }, /demasiados/)


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

console.log('\nBorrar cuenta (Ley 1581)')
await ok('al borrar la cuenta del solicitante se anonimizan sus datos de contacto', async () => {
  await as('other', `select public.delete_account()`)
  const rows = await pg.query(`select contact_name, contact_phone, note, requested_by from public.bookings where id = $1`, [b3])
  eq([rows.rows[0].contact_name, rows.rows[0].contact_phone, rows.rows[0].note, rows.rows[0].requested_by], ['', null, null, null], 'datos de contacto')
})
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
