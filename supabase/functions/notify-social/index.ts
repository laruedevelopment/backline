// Edge Function `notify-social`: avisos push de mensajes del chat de la banda, mensajes directos y solicitudes de amistad.
// La llama la app (con la sesión de quien escribió) justo después de enviar. Variables: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
//
// Seguridad: exige sesión válida; solo avisa si quien llama es el autor de lo que avisa; solo lo reciente (5 min); cada cosa se avisa
// una sola vez (columna notified_at); el texto sale de la base, no de lo que mande el cliente; las suscripciones caducadas se borran.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { bandMessageNotice, directNotice, friendAcceptedNotice, friendRequestNotice, isFresh, type Notice } from './logic.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f-]{36}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@backline.app'
  if (!pub || !priv) return json({ ok: true, sent: 0, note: 'push sin configurar' })

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: auth } = await userClient.auth.getUser()
  const caller = auth.user?.id
  if (!caller) return json({ error: 'no autenticado' }, 401)

  let kind: unknown, id: unknown
  try { ({ kind, id } = await req.json()) } catch { return json({ error: 'solicitud inválida' }, 400) }
  if (typeof id !== 'string' || !UUID.test(id) || !['band_message', 'direct', 'friend_request', 'friend_accepted'].includes(String(kind))) return json({ error: 'solicitud inválida' }, 400)

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const name = async (uid: string) => (await admin.from('profiles').select('display_name').eq('id', uid).maybeSingle()).data?.display_name ?? ''
  let notice: Notice | null = null
  let to: string[] = []

  if (kind === 'band_message') {
    const { data: m } = await admin.from('band_messages').select('id, band_id, profile_id, body, created_at, notified_at').eq('id', id).maybeSingle()
    if (!m || m.profile_id !== caller || m.notified_at || !isFresh(m.created_at)) return json({ ok: true, sent: 0 })
    const { data: claimed } = await admin.from('band_messages').update({ notified_at: new Date().toISOString() }).eq('id', id).is('notified_at', null).select('id')
    if (!claimed?.length) return json({ ok: true, sent: 0 })
    const [{ data: band }, { data: members }] = await Promise.all([
      admin.from('bands').select('name').eq('id', m.band_id).single(),
      admin.from('band_members').select('profile_id, guest_until').eq('band_id', m.band_id).neq('profile_id', caller),
    ])
    const today = new Date().toISOString().slice(0, 10)
    to = (members ?? []).filter((x) => !x.guest_until || x.guest_until >= today).map((x) => x.profile_id)
    notice = bandMessageNotice(m.band_id, band?.name ?? 'Tu banda', await name(caller), m.body)
  } else if (kind === 'direct') {
    const { data: m } = await admin.from('direct_messages').select('id, sender, recipient, body, created_at, notified_at').eq('id', id).maybeSingle()
    if (!m || m.sender !== caller || m.notified_at || !isFresh(m.created_at)) return json({ ok: true, sent: 0 })
    const { data: claimed } = await admin.from('direct_messages').update({ notified_at: new Date().toISOString() }).eq('id', id).is('notified_at', null).select('id')
    if (!claimed?.length) return json({ ok: true, sent: 0 })
    to = [m.recipient]
    notice = directNotice(caller, await name(caller), m.body)
  } else {
    const { data: f } = await admin.from('friendships').select('id, requester, addressee, status, created_at, responded_at, notified_status').eq('id', id).maybeSingle()
    if (!f || f.notified_status === f.status) return json({ ok: true, sent: 0 })
    const accepted = kind === 'friend_accepted'
    if (accepted ? (f.status !== 'accepted' || f.addressee !== caller || !isFresh(f.responded_at ?? f.created_at)) : (f.status !== 'pending' || f.requester !== caller || !isFresh(f.created_at))) return json({ ok: true, sent: 0 })
    const { data: claimed } = await admin.from('friendships').update({ notified_status: f.status }).eq('id', id).or(`notified_status.is.null,notified_status.neq.${f.status}`).select('id')
    if (!claimed?.length) return json({ ok: true, sent: 0 })
    to = [accepted ? f.requester : f.addressee]
    notice = accepted ? friendAcceptedNotice(await name(caller)) : friendRequestNotice(await name(caller))
  }

  if (!notice || !to.length) return json({ ok: true, sent: 0 })
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', to)
  if (!subs?.length) return json({ ok: true, sent: 0 })

  webpush.setVapidDetails(subject, pub, priv)
  const payload = JSON.stringify(notice)
  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'normal' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return json({ ok: true, sent })
})
