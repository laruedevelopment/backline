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
  try {
    await pg.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
    console.log('OK  migración', f)
  } catch (e) {
    console.log('FALLA migración', f, '→', e.message)
    process.exit(1)
  }
}
// Repetibilidad: la 0008 y la 0009 deben poder correr dos veces.
for (const f of ['20261020000008_logo_y_fotos.sql', '20261020000009_salas_y_reservas.sql']) {
  try { await pg.exec(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('OK  re-ejecución', f) } catch (e) { console.log('FALLA re-ejecución', f, '→', e.message) }
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
  const [p] = await as('owner', `select terms_version, age_declaration, accepted_terms_at is not null as at from public.profiles where id = $1`, [U.owner])
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
