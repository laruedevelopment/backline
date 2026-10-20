// Edge Function `sync-calendars`: lee el Google Calendar (dirección secreta iCal) de cada sala de una sala de ensayos y guarda
// solo las horas ocupadas. La llama la app cuando alguien abre la reserva de una sala de ensayos (si la última lectura tiene más de
// 5 minutos) y el dueño con «Sincronizar ahora».
//
// Seguridad:
//  - exige sesión; quien llama no puede indicar URLs: se leen de la base y deben ser de calendar.google.com (también lo exige un CHECK en la tabla);
//  - sin seguir redirecciones, con tiempo y tamaño máximos;
//  - se guardan únicamente horas, nunca títulos ni descripciones;
//  - solo se sincronizan salas de ensayos publicadas o propias; «forzar» solo lo puede el dueño.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { busyFromIcs } from './ics.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ICAL_URL = /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^/\s]+\/(private-[A-Za-z0-9]+|public)\/basic\.ics$/
const STALE_MS = 5 * 60_000
const MAX_BYTES = 5 * 1024 * 1024
const DAY = 86_400_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: auth } = await userClient.auth.getUser()
  const caller = auth.user?.id
  if (!caller) return json({ error: 'no autenticado' }, 401)

  let venueId: unknown, force = false
  try { const b = await req.json(); venueId = b.venue_id; force = b.force === true } catch { return json({ error: 'solicitud inválida' }, 400) }
  if (typeof venueId !== 'string' || !/^[0-9a-f-]{36}$/i.test(venueId)) return json({ error: 'solicitud inválida' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: venue } = await admin.from('venues').select('owner_id, is_published').eq('id', venueId).maybeSingle()
  if (!venue || !(venue.is_published || venue.owner_id === caller)) return json({ ok: true, synced: 0, skipped: 0, errors: 0 })
  if (force && venue.owner_id !== caller) force = false

  const { data: sources } = await admin.from('room_calendar_sources').select('room_id, url, last_synced_at').eq('venue_id', venueId)
  let synced = 0, skipped = 0, errors = 0

  await Promise.all((sources ?? []).map(async (s) => {
    if (!force && s.last_synced_at && Date.now() - new Date(s.last_synced_at).getTime() < STALE_MS) { skipped++; return }
    try {
      if (!ICAL_URL.test(s.url)) throw new Error('dirección no válida')
      const res = await fetch(s.url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { Accept: 'text/calendar' } })
      if (res.status !== 200) throw new Error(`Google respondió ${res.status}`)
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) throw new Error('el calendario es demasiado grande')
      const text = new TextDecoder().decode(buf)
      if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('no es un calendario iCal')

      const now = Date.now()
      const busy = busyFromIcs(text, new Date(now - DAY), new Date(now + 120 * DAY))
      const { data: n, error } = await admin.rpc('replace_external_busy', { p_room: s.room_id, p_rows: busy })
      if (error) throw new Error('no se pudieron guardar las horas')
      await admin.from('room_calendar_sources').update({ last_synced_at: new Date().toISOString(), last_status: 'ok', last_error: null, blocks_count: n ?? busy.length }).eq('room_id', s.room_id)
      synced++
    } catch (e) {
      errors++
      // Se anota la hora igualmente para no insistir en cada visita; el mensaje no incluye la dirección secreta.
      await admin.from('room_calendar_sources').update({ last_synced_at: new Date().toISOString(), last_status: 'error', last_error: String((e as Error).message).slice(0, 180) }).eq('room_id', s.room_id)
    }
  }))
  return json({ ok: true, synced, skipped, errors })
})
