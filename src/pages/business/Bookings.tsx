import ListSkeleton from '../../components/Skeleton'
import { dayKey, formatDay } from '../../lib/slots'
import type { Booking } from '../../lib/venues'
import { useVenue } from './BusinessContext'
import BookingRow from './BookingRow'
import { useBookingBoard } from './useBookingBoard'

/** Todas las reservas del ensayadero, agrupadas por día. */
export default function BusinessBookings() {
  const venue = useVenue()
  const board = useBookingBoard(venue)

  const active = [...board.pending, ...board.confirmed].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const days = new Map<string, Booking[]>()
  for (const b of active) {
    const k = dayKey(new Date(b.startsAt))
    days.set(k, [...(days.get(k) ?? []), b])
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{venue.name}</span>
        <h1 className="page-title">Reservas</h1>
        <p className="page-sub">Lo que viene, día por día. Las que llegan por WhatsApp o llamada puedes anotarlas aquí para que las bandas vean la disponibilidad real.</p>
      </div>
      <button className="btn" onClick={board.addManual} disabled={board.rooms.length === 0}>Anotar una reserva</button>
      {board.msg && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{board.msg}</p>}
      {board.isLoading && <ListSkeleton rows={4} />}
      {!board.isLoading && active.length === 0 && (
        <div className="empty">
          <h3>Sin reservas por ahora</h3>
          <p>Cuando una banda pida una franja o tú anotes una, aparece aquí ordenada por día.</p>
        </div>
      )}

      {[...days.entries()].map(([key, items]) => (
        <section key={key}>
          <div className="section-title">{formatDay(new Date(items[0].startsAt))}</div>
          <div className="list">
            {items.map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} showDay={false} />)}
          </div>
        </section>
      ))}

      {board.history.length > 0 && (
        <>
          <div className="section-title">Historial</div>
          <div className="list">
            {board.history.map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} />)}
          </div>
        </>
      )}
      {board.sheets}
    </>
  )
}
