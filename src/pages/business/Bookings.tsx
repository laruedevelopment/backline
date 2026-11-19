import { useState } from 'react'
import ListSkeleton from '../../components/Skeleton'
import { dayKey, formatDay } from '../../lib/slots'
import PageHead from '../../components/PageHead'
import type { Booking } from '../../lib/venues'
import { useVenue } from './BusinessContext'
import BookingRow from './BookingRow'
import { useBookingBoard } from './useBookingBoard'

/** Todas las reservas de la sala de ensayos, agrupadas por día. */
export default function BusinessBookings() {
  const venue = useVenue()
  const board = useBookingBoard(venue)
  const [allHistory, setAllHistory] = useState(false)

  const active = [...board.pending, ...board.confirmed].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const days = new Map<string, Booking[]>()
  for (const b of active) {
    const k = dayKey(new Date(b.startsAt))
    days.set(k, [...(days.get(k) ?? []), b])
  }

  return (
    <>
      <PageHead eyebrow={`Mi negocio · ${venue.name}`} title="Reservas" info="Lo que viene, día por día. Las que llegan por WhatsApp o llamada puedes anotarlas aquí para que las bandas vean la disponibilidad real." />
      <div className="toolbar"><button className="btn primary" onClick={board.addManual} disabled={board.rooms.length === 0}>Anotar una reserva</button></div>
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
            {board.history.slice(0, allHistory ? 15 : 5).map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} compact />)}
          </div>
          {!allHistory && board.history.length > 5 && <button className="btn block" style={{ marginTop: 10 }} onClick={() => setAllHistory(true)}>Ver más ({board.history.length - 5})</button>}
        </>
      )}
      {board.sheets}
    </>
  )
}
