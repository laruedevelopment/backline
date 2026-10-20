// Edge Function `notify-booking`: manda una notificación push a la otra parte cuando cambia una reserva.
// La llama la app (con la sesión de quien hizo el cambio) justo después de pedir, responder o cancelar una reserva.
//
// Variables de entorno (las de SUPABASE_* las pone Supabase solo):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (p. ej. mailto:tu@correo.com)  → `npx supabase secrets set …`
//
// Seguridad: exige sesión válida; solo avisa si quien llama es parte de la reserva; el texto sale del estado real de la
// reserva (no de lo que mande el cliente); cada estado se avisa una sola vez; las suscripciones caducadas se borran.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildNotice, type BookingFacts } from './logic.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@backline.app'
  // Sin llaves configuradas no es un error de la app: simplemente no hay avisos todavía.
  if (!pub || !priv) return json({ ok: true, sent: 0, note: 'push sin configurar' })

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: auth } = await userClient.auth.getUser()
  const caller = auth.user?.id
  if (!caller) return json({ error: 'no autenticado' }, 401)

  let bookingId: unknown
  try { bookingId = (await req.json()).booking_id } catch { return json({ error: 'solicitud inválida' }, 400) }
  if (typeof bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(bookingId)) return json({ error: 'solicitud inválida' }, 400)

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: b } = await admin.from('bookings')
    .select('id, status, source, requested_by, contact_name, starts_at, ends_at, last_notified_status, venue_id, room_id')
    .eq('id', bookingId).maybeSingle()
  if (!b) return json({ ok: true, sent: 0 })

  const [venue, room] = await Promise.all([
    admin.from('venues').select('owner_id, name, auto_confirm').eq('id', b.venue_id).single(),
    admin.from('venue_rooms').select('name').eq('id', b.room_id).single(),
  ])
  if (!venue.data || !room.data) return json({ ok: true, sent: 0 })

  const facts: BookingFacts = {
    status: b.status, source: b.source, requestedBy: b.requested_by, ownerId: venue.data.owner_id, contactName: b.contact_name,
    roomName: room.data.name, venueName: venue.data.name, startsAt: b.starts_at, endsAt: b.ends_at,
    autoConfirmed: venue.data.auto_confirm, lastNotifiedStatus: b.last_notified_status,
  }
  const notice = buildNotice(facts, caller)
  if (!notice) return json({ ok: true, sent: 0 })

  // Reserva atómica del aviso: si dos llamadas llegan a la vez, solo una continúa.
  const { data: claimed } = await admin.from('bookings').update({ last_notified_status: b.status })
    .eq('id', b.id).or(`last_notified_status.is.null,last_notified_status.neq.${b.status}`).select('id')
  if (!claimed?.length) return json({ ok: true, sent: 0 })

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', notice.to)
  if (!subs?.length) return json({ ok: true, sent: 0 })

  webpush.setVapidDetails(subject, pub, priv)
  const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url, tag: notice.tag })
  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id) // el dispositivo ya no existe
    }
  }))
  return json({ ok: true, sent })
})
