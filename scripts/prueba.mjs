// Datos de PRUEBA para revisar la app con información realista. Todo lo que crea queda marcado y se borra con `limpiar`.
//
//   node scripts/prueba.mjs sembrar   → crea 3 cuentas de prueba, 1 banda, 2 negocios, canciones, setlists, agenda y reservas
//   node scripts/prueba.mjs limpiar   → borra todo lo marcado como prueba (nada más)
//   node scripts/prueba.mjs estado    → cuenta lo que hay marcado como prueba
//
// Marcas: nombres que terminan en «(PRUEBA)» y correos @backline-prueba.test. Usa la sesión de la CLI de Supabase
// (`npx supabase login`); la llave de servicio solo vive en memoria durante la ejecución y no se imprime ni se guarda.
import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REF = 'xmhwgdqcjvpsfezxnjuz'
const URL = `https://${REF}.supabase.co`
const DOMAIN = 'backline-prueba.test'
const JAVIER_EMAIL = 'javieruedase@gmail.com'

const run = (args) => {
  const r = spawnSync('npx', ['supabase', ...args], { encoding: 'utf8', shell: true, maxBuffer: 50 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`supabase ${args[0]} falló:\n${(r.stderr || r.stdout).slice(0, 1500)}`)
  return r.stdout
}

function sql(text) {
  const file = path.join(os.tmpdir(), `backline-prueba-${randomUUID()}.sql`)
  fs.writeFileSync(file, text)
  try {
    const out = run(['db', 'query', '--linked', '--project-ref', REF, '--output-format', 'json', '-f', file])
    const json = JSON.parse(out.slice(out.indexOf('{')))
    return json.rows ?? []
  } finally { fs.rmSync(file, { force: true }) }
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const qj = (o) => `${q(JSON.stringify(o))}::jsonb`
const qa = (arr) => `'{${arr.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'`

// ───────── fechas en hora de Colombia ─────────
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
const day = (n) => fmt.format(new Date(Date.now() + n * 86_400_000))
const at = (n, hm) => new Date(`${day(n)}T${hm}:00-05:00`).toISOString()

// ───────── estado ─────────
function estado() {
  const [r] = sql(`select
    (select count(*) from auth.users where email like '%@${DOMAIN}') as cuentas,
    (select count(*) from public.bands where name like '%(PRUEBA)') as bandas,
    (select count(*) from public.venues where name like '%(PRUEBA)') as negocios,
    (select count(*) from public.songs where band_id in (select id from public.bands where name like '%(PRUEBA)')) as canciones,
    (select count(*) from public.events where title like '%(PRUEBA)%' or place like '%(PRUEBA)%' or band_id in (select id from public.bands where name like '%(PRUEBA)')) as eventos,
    (select count(*) from public.bookings where venue_id in (select id from public.venues where name like '%(PRUEBA)')) as reservas`)
  return r
}

// ───────── limpiar ─────────
function limpiar() {
  console.log('Antes:', JSON.stringify(estado()))
  sql(`
    delete from public.events where title like '%(PRUEBA)%' or place like '%(PRUEBA)%' or band_id in (select id from public.bands where name like '%(PRUEBA)');
    delete from public.bands where name like '%(PRUEBA)';
    delete from public.venues where name like '%(PRUEBA)';
    delete from auth.users where email like '%@${DOMAIN}';
  `)
  const after = estado()
  console.log('Después:', JSON.stringify(after))
  const left = Object.values(after).reduce((t, n) => t + Number(n), 0)
  if (left) throw new Error('Quedaron datos de prueba sin borrar.')
  console.log('Listo: no queda ningún dato de prueba.')
}

// ───────── sembrar ─────────
async function sembrar() {
  const before = estado()
  if (Object.values(before).some((n) => Number(n) > 0)) throw new Error(`Ya hay datos de prueba (${JSON.stringify(before)}). Ejecuta «limpiar» primero.`)

  const [jv] = sql(`select id from auth.users where email = ${q(JAVIER_EMAIL)}`)
  if (!jv) throw new Error(`No encontré tu cuenta (${JAVIER_EMAIL}).`)
  const J = jv.id

  // llave de servicio: solo en memoria
  const keys = JSON.parse(run(['projects', 'api-keys', '--project-ref', REF]).slice(0)).keys
  const service = keys.find((k) => k.id === 'service_role')?.api_key
  if (!service) throw new Error('No pude leer la llave de servicio.')

  const password = randomBytes(9).toString('base64url') + '!7'
  async function crearCuenta(slug, name) {
    const res = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${slug}@${DOMAIN}`, password, email_confirm: true, user_metadata: { name, terms_version: '0.3', age_declaration: 'adult' } }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`No pude crear ${slug}: ${JSON.stringify(body).slice(0, 200)}`)
    return body.id
  }
  const U1 = await crearCuenta('duena', 'Valentina Test')
  const U2 = await crearCuenta('sebas', 'Sebas Test')
  const U3 = await crearCuenta('dani', 'Dani Test')

  const id = () => randomUUID()
  const B1 = id(), V1 = id(), V2 = id()
  const sA = id(), sB = id(), cab = id(), sal2 = id()
  const song = Array.from({ length: 8 }, id)
  const std = [{ instrument: 'Todos', tuning: 'E estándar' }]

  const songs = [
    ['Seven Nation Army', 'The White Stripes', 'Em', 124, 4, 'ready', std, [], 'https://youtu.be/0J2QdDbelmY', 'Riff de bajo: que suene a guitarra.'],
    ['Come Together', 'The Beatles', 'Dm', 82, 4, 'ready', std, [], 'https://youtu.be/45cYwDMibGo', null],
    ['Black Hole Sun', 'Soundgarden', 'B', 104, 5, 'ready', [{ instrument: 'Guitarra', tuning: 'Drop D' }, { instrument: 'Bajo', tuning: 'E estándar' }], [{ section: 'Puente', from: 'B', to: 'D' }], 'https://open.spotify.com/track/5FVd6KXrgO9B3JPmC8OPst', null],
    ['Smooth Operator', 'Sade', 'Dm', 118, 5, 'learning', std, [], null, 'Falta definir el solo de saxo.'],
    ['Wonderwall', 'Oasis', 'F#m', 87, 4, 'paused', [{ instrument: 'Guitarra', tuning: 'E estándar', capo: 2 }], [], null, null],
    ['Superstition', 'Stevie Wonder', 'Ebm', 101, 4, 'ready', std, [], null, 'Que el bombo respire entre los golpes.'],
    ['La camisa negra', 'Juanes', 'Am', 96, 4, 'ready', std, [], null, null],
    ['Bohemian Rhapsody', 'Queen', 'Bb', 72, 6, 'learning', std, [{ section: 'Ópera', from: 'Bb', to: 'Eb' }], null, 'Solo la parte del piano y el coro.'],
  ]

  const eq = (room, venue, kind, o = {}) => `(${q(room)}, ${q(venue)}, ${q(kind)}, ${o.title ? q(o.title) : 'null'}, ${o.quantity ?? 1}, ${o.format ? q(o.format) : 'null'}, ${o.brand ? q(o.brand) : 'null'}, ${o.model ? q(o.model) : 'null'}, ${o.channels ?? 'null'}, ${o.details ? q(o.details) : 'null'}, ${o.included === false ? 'false' : 'true'}, ${o.price ?? 'null'}, ${q(o.unit ?? 'hour')})`

  const evRehearsal = id(), evGig = id(), evPast = id()
  const bk = { pend: id(), conf: id(), manual: id(), past: id(), rej: id(), canc: id(), v2pend: id(), v2conf: id() }

  const script = `
    update public.profiles set instruments = '{Bajo}', city = 'Bucaramanga' where id = ${q(U2)};
    update public.profiles set instruments = '{Batería}', city = 'Bucaramanga' where id = ${q(U3)};
    update public.profiles set instruments = '{Teclado,Voz}', city = 'Bucaramanga' where id = ${q(U1)};

    -- Banda de prueba (tú eres admin)
    insert into public.bands (id, name, city, genres, bio, links, created_by) values (${q(B1)}, 'Los Chinos (PRUEBA)', 'Bucaramanga', ${qa(['Rock', 'Funk'])},
      'Banda de prueba para revisar la app: repertorio, setlists, agenda y reservas.', ${qj({ instagram: 'https://instagram.com/loschinos', youtube: 'https://youtube.com/@loschinos' })}, ${q(U2)});
    insert into public.band_members (band_id, profile_id, role, instrument) values
      (${q(B1)}, ${q(U2)}, 'owner', 'Bajo'), (${q(B1)}, ${q(U3)}, 'member', 'Batería'), (${q(B1)}, ${q(J)}, 'admin', 'Guitarra');

    insert into public.songs (id, band_id, title, artist, key, bpm, minutes, status, tunings, key_changes, links, notes) values
      ${songs.map((s, i) => `(${q(song[i])}, ${q(B1)}, ${q(s[0])}, ${q(s[1])}, ${q(s[2])}, ${s[3]}, ${s[4]}, ${q(s[5])}, ${qj(s[6])}, ${qj(s[7])}, ${qj(s[8] ? (s[8].includes('spotify') ? { spotify: s[8] } : { youtube: s[8] }) : {})}, ${s[9] ? q(s[9]) : 'null'})`).join(',\n      ')};

    insert into public.setlists (band_id, name, song_ids) values
      (${q(B1)}, 'Toque Bar La Esquina (PRUEBA)', ${q(`{${[song[0], song[5], song[1], song[2], song[6], song[7]].join(',')}}`)}::uuid[]),
      (${q(B1)}, 'Ensayo general (PRUEBA)', ${q(`{${song.slice(0, 5).join(',')}}`)}::uuid[]);

    -- Negocios: La Tarima (de Valentina, aprobación manual) y Estudio Eco (tuyo, confirmación automática)
    insert into public.venues (id, owner_id, kind, name, city, address, description, amenities, whatsapp, links, is_published, auto_confirm, lat, lng) values
      (${q(V1)}, ${q(U1)}, 'rehearsal_room', 'La Tarima (PRUEBA)', 'Bucaramanga', 'Cra 33 # 45-12, Cabecera',
       'Dos salas con backline completo, aire acondicionado y parqueadero. A tres cuadras de la UIS. Datos de prueba.', ${qa(['Aire acondicionado', 'Parqueadero', 'Zona de espera', 'Nevera'])},
       '3001234567', ${qj({ instagram: 'https://instagram.com/latarima' })}, true, false, 7.119349, -73.122742),
      (${q(V2)}, ${q(J)}, 'studio', 'Estudio Eco (PRUEBA)', 'Floridablanca', 'Calle 5 # 8-30, Centro',
       'Estudio de grabación con cabina y sala de ensayo. Confirma las reservas al instante. Datos de prueba.', ${qa(['Grabación', 'Aire acondicionado'])},
       '3109998877', ${qj({})}, true, true, 7.062200, -73.086400);

    insert into public.venue_rooms (id, venue_id, name, capacity, price_per_hour, description, width_m, length_m, height_m) values
      (${q(sA)}, ${q(V1)}, 'Sala A', 6, 35000, 'La sala grande: cabe una banda de 6 con espacio para el sonidista.', 4.5, 6, 2.8),
      (${q(sB)}, ${q(V1)}, 'Sala B', 4, 25000, 'Más pequeña, ideal para dúos y trío acústico.', 3, 4, null),
      (${q(cab)}, ${q(V2)}, 'Cabina de grabación', 5, 60000, 'Cabina tratada acústicamente con control room.', 3.5, 4.5, 2.6),
      (${q(sal2)}, ${q(V2)}, 'Sala de ensayo', 6, 30000, null, 4, 5, null);

    insert into public.venue_hours (venue_id, weekday, opens, closes)
      select v, d, case when d = 0 then '10:00' else '08:00' end::time, case when d = 0 then '20:00' else '22:00' end::time
      from (values (${q(V1)}::uuid), (${q(V2)}::uuid)) as vs(v), generate_series(0, 6) as d;

    insert into public.room_equipment (room_id, venue_id, kind, title, quantity, format, brand, model, channels, details, included, extra_price, extra_unit) values
      ${[
        eq(sA, V1, 'guitar_amp', { quantity: 2, format: 'combo', brand: 'Fender', model: 'Hot Rod Deluxe' }),
        eq(sA, V1, 'bass_amp', { format: 'head_cabinet', brand: 'Ampeg', model: 'SVT-4 Pro + 8x10', details: 'Cabezote 1200 W' }),
        eq(sA, V1, 'drums', { brand: 'Pearl', model: 'Export', details: 'Bombo, caja, 2 toms, tom de piso, 3 platillos y silla.' }),
        eq(sA, V1, 'mixer', { format: 'digital', channels: 16, brand: 'Behringer', model: 'X32 Compact' }),
        eq(sA, V1, 'mics', { quantity: 4, brand: 'Shure', model: 'SM58' }),
        eq(sA, V1, 'guitar', { quantity: 2, included: false, price: 15000, unit: 'session', details: 'Stratocaster y Les Paul' }),
        eq(sA, V1, 'keyboard', { included: false, price: 20000, unit: 'session', brand: 'Yamaha', model: 'PSR-E373' }),
        eq(sB, V1, 'guitar_amp', { format: 'combo' }),
        eq(sB, V1, 'drums'),
        eq(cab, V2, 'mixer', { format: 'analog', channels: 24, brand: 'Mackie', model: '2404-VLZ4' }),
        eq(cab, V2, 'mics', { quantity: 6, details: 'Condensadores y dinámicos' }),
        eq(sal2, V2, 'drums', { details: 'Batería de cinco cuerpos' }),
        eq(sal2, V2, 'bass', { included: false, price: null, details: 'Bajo Precision, consultar' }),
      ].join(',\n      ')};

    -- Reservas de La Tarima
    insert into public.bookings (id, venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, status, note, response_note, source, responded_at) values
      (${q(bk.pend)}, ${q(V1)}, ${q(sA)}, ${q(B1)}, ${q(U2)}, 'Sebas Test', '3105550101', ${q(at(2, '19:00'))}, ${q(at(2, '21:00'))}, 'requested', 'Somos 4, llevamos platillos.', null, 'app', null),
      (${q(bk.conf)}, ${q(V1)}, ${q(sB)}, ${q(B1)}, ${q(U2)}, 'Sebas Test', '3105550101', ${q(at(1, '18:00'))}, ${q(at(1, '20:00'))}, 'confirmed', 'Ensayo antes del toque.', null, 'app', now()),
      (${q(bk.manual)}, ${q(V1)}, ${q(sA)}, null, null, 'Los Pibes', '3205550202', ${q(at(3, '16:00'))}, ${q(at(3, '18:00'))}, 'confirmed', 'Reserva por WhatsApp.', null, 'owner', now()),
      (${q(bk.past)}, ${q(V1)}, ${q(sA)}, ${q(B1)}, ${q(U2)}, 'Sebas Test', null, ${q(at(-4, '18:00'))}, ${q(at(-4, '20:00'))}, 'confirmed', null, null, 'app', now()),
      (${q(bk.rej)}, ${q(V1)}, ${q(sB)}, null, ${q(U3)}, 'Dani Test', null, ${q(at(4, '10:00'))}, ${q(at(4, '12:00'))}, 'rejected', null, 'Ese día hay mantenimiento.', 'app', now()),
      (${q(bk.canc)}, ${q(V1)}, ${q(sA)}, null, ${q(U3)}, 'Dani Test', null, ${q(at(5, '15:00'))}, ${q(at(5, '16:00'))}, 'cancelled', null, null, 'app', now());
    -- Reservas del Estudio Eco (tuyo)
    insert into public.bookings (id, venue_id, room_id, band_id, requested_by, contact_name, contact_phone, starts_at, ends_at, status, note, source, responded_at) values
      (${q(bk.v2pend)}, ${q(V2)}, ${q(cab)}, ${q(B1)}, ${q(U2)}, 'Sebas Test', '3105550101', ${q(at(2, '17:00'))}, ${q(at(2, '19:00'))}, 'requested', 'Queremos grabar una maqueta de 2 canciones.', 'app', null),
      (${q(bk.v2conf)}, ${q(V2)}, ${q(sal2)}, null, ${q(U3)}, 'Dani Test', null, ${q(at(3, '10:00'))}, ${q(at(3, '13:00'))}, 'confirmed', null, 'app', now());
    select public.booking_to_event(${q(bk.conf)});

    -- Horas ocupadas "leídas" de un calendario externo (para ver franjas tachadas)
    insert into public.room_external_busy (room_id, starts_at, ends_at) values
      (${q(sA)}, ${q(at(1, '14:00'))}, ${q(at(1, '16:00'))}), (${q(sA)}, ${q(at(6, '18:00'))}, ${q(at(6, '21:00'))});

    -- Agenda de la banda
    insert into public.events (id, band_id, kind, title, place, starts_at, notes, setlist_id, created_by)
      select ${q(evGig)}, ${q(B1)}, 'gig', 'Bar La Esquina (PRUEBA)', 'Cabecera, Bucaramanga', ${q(at(7, '21:30'))}, 'Montaje a las 8. Cada quien lleva sus cables.', s.id, ${q(U2)}
      from public.setlists s where s.band_id = ${q(B1)} and s.name = 'Toque Bar La Esquina (PRUEBA)';
    insert into public.events (id, band_id, kind, title, place, starts_at, notes, created_by) values
      (${q(evRehearsal)}, ${q(B1)}, 'rehearsal', 'Ensayo general (PRUEBA)', 'Sala propia', ${q(at(2, '20:00'))}, 'Repasar el setlist completo.', ${q(U2)}),
      (${q(evPast)}, ${q(B1)}, 'rehearsal', 'Ensayo pasado (PRUEBA)', 'La Tarima (PRUEBA)', ${q(at(-4, '18:00'))}, null, ${q(U2)});
    insert into public.event_rsvps (event_id, profile_id, status) values
      (${q(evGig)}, ${q(U2)}, 'yes'), (${q(evGig)}, ${q(U3)}, 'maybe'),
      (${q(evRehearsal)}, ${q(U2)}, 'yes'), (${q(evRehearsal)}, ${q(U3)}, 'yes'), (${q(evRehearsal)}, ${q(J)}, 'no');
  `
  sql(script)

  const after = estado()
  console.log('\nDatos de prueba creados:', JSON.stringify(after))
  console.log('\nCuentas de prueba (contraseña la misma para las tres):')
  console.log(`  duena@${DOMAIN}   Valentina Test: dueña de «La Tarima (PRUEBA)» (aprueba las reservas a mano)`)
  console.log(`  sebas@${DOMAIN}   Sebas Test: líder de «Los Chinos (PRUEBA)»`)
  console.log(`  dani@${DOMAIN}    Dani Test: baterista de la banda`)
  console.log(`  Contraseña: ${password}`)
  console.log(`\nEn tu cuenta (${JAVIER_EMAIL}): admin de «Los Chinos (PRUEBA)» y dueño de «Estudio Eco (PRUEBA)» (confirma al instante).`)
}

const cmd = process.argv[2]
try {
  if (cmd === 'sembrar') await sembrar()
  else if (cmd === 'limpiar') limpiar()
  else if (cmd === 'estado') console.log(JSON.stringify(estado()))
  else console.log('Uso: node scripts/prueba.mjs sembrar | limpiar | estado')
} catch (e) {
  console.error(String(e.message ?? e))
  process.exit(1)
}
