// Edge Function `housekeeping`: limpieza programada (la llama el workflow «Vencer reservas sin pago» cada hora).
//  - Borra con la API de Storage los comprobantes de pago que ya no hacen falta (Supabase no permite borrar archivos con SQL):
//      · de reservas canceladas o rechazadas hace más de 30 días (salvo las que tienen una devolución pendiente),
//      · de cualquier reserva cuya franja terminó hace más de 90 días.
//  - Borra el registro de errores de más de 30 días.
// No recibe parámetros: la regla es fija y del lado del servidor, así que llamarla de más no hace daño.
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const DAY = 86_400_000

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const now = Date.now()
  const cutCancelled = new Date(now - 30 * DAY).toISOString()
  const cutEnded = new Date(now - 90 * DAY).toISOString()

  const { data: rows, error } = await admin.from('bookings')
    .select('id, proof_path, status, pay_status, responded_at, ends_at')
    .not('proof_path', 'is', null)
    .or(`ends_at.lt.${cutEnded},and(status.in.(cancelled,rejected),responded_at.lt.${cutCancelled})`)
    .limit(200)
  if (error) return json({ error: 'no se pudo leer' }, 500)

  const due = (rows ?? []).filter((r) => r.pay_status !== 'refund_due' && r.proof_path)
  let removed = 0
  if (due.length) {
    const { error: rmErr } = await admin.storage.from('payment-proofs').remove(due.map((r) => r.proof_path as string))
    if (!rmErr) {
      await admin.from('bookings').update({ proof_path: null }).in('id', due.map((r) => r.id))
      removed = due.length
    }
  }

  const { count } = await admin.from('client_errors').delete({ count: 'exact' }).lt('created_at', new Date(now - 30 * DAY).toISOString())
  return json({ ok: true, proofs: removed, errors: count ?? 0 })
})
