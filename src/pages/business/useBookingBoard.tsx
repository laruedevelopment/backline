import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ManualBookingSheet from '../../components/ManualBookingSheet'
import RejectSheet from './RejectSheet'
import { ask } from '../../lib/confirm'
import { formatDay } from '../../lib/slots'
import { bookingError, cancelBooking, listRooms, respondBooking, reviewPayment, venueBookings, type Booking, type Venue } from '../../lib/venues'

export const statusLabel = { requested: 'Pendiente', confirmed: 'Confirmada', rejected: 'Rechazada', cancelled: 'Cancelada' } as const

/** Todo lo que el dueño hace con las reservas de su negocio: leerlas, confirmar, rechazar, cancelar y anotar a mano. */
export function useBookingBoard(venue: Venue) {
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  const [manual, setManual] = useState(false)
  const [msg, setMsg] = useState('')
  const [now] = useState(() => new Date())

  const { data: bookings = [], isLoading } = useQuery({ queryKey: ['venue-bookings', venue.id], queryFn: () => venueBookings(venue.id) })
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['venue-bookings', venue.id] }), qc.invalidateQueries({ queryKey: ['busy'] })])

  const respond = useMutation({
    mutationFn: (v: { id: string; status: 'confirmed' | 'rejected'; note: string }) => respondBooking(v.id, v.status, v.note),
    onSuccess: refresh,
    onError: (e) => { setMsg(bookingError(e)); void refresh() },
  })
  const review = useMutation({
    mutationFn: (v: { id: string; action: 'paid' | 'reject' | 'refunded' | 'no_refund'; note: string }) => reviewPayment(v.id, v.action, v.note),
    onSuccess: refresh,
    onError: (e) => { setMsg(bookingError(e)); void refresh() },
  })
  const cancel = useMutation({ mutationFn: cancelBooking, onSuccess: refresh, onError: (e) => setMsg(bookingError(e)) })

  const upcoming = (b: Booking) => new Date(b.endsAt) > now
  const pending = bookings.filter((b) => b.status === 'requested' && upcoming(b))
  const confirmed = bookings.filter((b) => b.status === 'confirmed' && upcoming(b))
  const history = bookings.filter((b) => !pending.includes(b) && !confirmed.includes(b)).reverse().slice(0, 15)

  async function onCancel(b: Booking) {
    if (!(await ask({ title: '¿Cancelar esta reserva?', body: `${b.contactName || 'La banda'} · ${formatDay(new Date(b.startsAt))}. La franja queda libre otra vez.`, confirmLabel: 'Cancelar reserva' }))) return
    setMsg('')
    cancel.mutate(b.id)
  }

  const sheets = (
    <>
      {manual && <ManualBookingSheet venueId={venue.id} bookings={bookings} rooms={rooms} onClose={() => setManual(false)} onSaved={refresh} />}
      {rejecting && (
        <RejectSheet booking={rejecting} onClose={() => setRejecting(null)}
          onReject={(note) => { setMsg(''); respond.mutate({ id: rejecting.id, status: 'rejected', note }); setRejecting(null) }} />
      )}
    </>
  )

  return {
    bookings, rooms, isLoading, pending, confirmed, history, msg, now, sheets, busy: respond.isPending || cancel.isPending || review.isPending,
    refund: (b: Booking, action: 'refunded' | 'no_refund') => { setMsg(''); review.mutate({ id: b.id, action, note: '' }) },
    markPaid: (b: Booking) => { setMsg(''); review.mutate({ id: b.id, action: 'paid', note: '' }) },
    rejectProof: (b: Booking) => { setMsg(''); const note = window.prompt('¿Qué pasó con el comprobante? (opcional, se lo mostramos al cliente)', 'No se alcanza a ver el valor o la fecha') ; if (note !== null) review.mutate({ id: b.id, action: 'reject', note }) },
    confirm: (b: Booking) => { setMsg(''); respond.mutate({ id: b.id, status: 'confirmed', note: '' }) },
    reject: (b: Booking) => setRejecting(b),
    cancel: onCancel,
    addManual: () => setManual(true),
  }
}

export type BookingBoard = ReturnType<typeof useBookingBoard>
