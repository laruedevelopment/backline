// Lógica pura de la función `notify-booking` (sin Deno ni red): quién recibe el aviso y qué dice.
// Está aparte para poder probarla con vitest.

export type BookingStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled'

export type BookingFacts = {
  status: BookingStatus
  source: 'app' | 'owner'
  requestedBy: string | null
  ownerId: string
  contactName: string
  roomName: string
  venueName: string
  startsAt: string
  endsAt: string
  autoConfirmed: boolean
  lastNotifiedStatus: string | null
}

export type Notice = { to: string; title: string; body: string; url: string; tag: string }

const TZ = 'America/Bogota'
const day = (iso: string) => {
  const t = new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const when = (b: BookingFacts) => `${day(b.startsAt)}, ${time(b.startsAt)} a ${time(b.endsAt)}`

/**
 * Decide a quién avisar a partir de quién llama: el solicitante avisa al dueño y el dueño avisa al solicitante.
 * El texto sale del estado real de la reserva, nunca de lo que mande el cliente.
 * Devuelve null si el que llama no es parte de la reserva, si no hay a quién avisar o si ya se avisó ese estado.
 */
export function buildNotice(b: BookingFacts, callerId: string): Notice | null {
  if (b.lastNotifiedStatus === b.status) return null
  const tag = `reserva-${b.status}`
  const fromRequester = !!b.requestedBy && callerId === b.requestedBy
  const fromOwner = callerId === b.ownerId

  if (fromRequester && !fromOwner) {
    const who = b.contactName || 'Una banda'
    switch (b.status) {
      case 'requested':
        return { to: b.ownerId, tag, url: 'mi-negocio', title: 'Nueva solicitud de reserva', body: `${who} pide ${b.roomName}: ${when(b)}.` }
      case 'confirmed':
        return { to: b.ownerId, tag, url: 'mi-negocio', title: 'Nueva reserva confirmada', body: `${who} reservó ${b.roomName}: ${when(b)}.` }
      case 'cancelled':
        return { to: b.ownerId, tag, url: 'mi-negocio', title: 'Reserva cancelada', body: `${who} canceló ${b.roomName}: ${when(b)}.` }
      default:
        return null
    }
  }

  if (fromOwner && b.requestedBy) {
    switch (b.status) {
      case 'confirmed':
        return { to: b.requestedBy, tag, url: 'ensayaderos', title: '¡Tu reserva fue confirmada!', body: `${b.venueName} · ${b.roomName}: ${when(b)}.` }
      case 'rejected':
        return { to: b.requestedBy, tag, url: 'ensayaderos', title: 'Tu solicitud no fue aceptada', body: `${b.venueName} no puede el ${when(b)}. Mira el motivo y prueba otra franja.` }
      case 'cancelled':
        return { to: b.requestedBy, tag, url: 'ensayaderos', title: 'La sala de ensayos canceló tu reserva', body: `${b.venueName} · ${b.roomName}: ${when(b)}.` }
      default:
        return null
    }
  }
  return null
}
