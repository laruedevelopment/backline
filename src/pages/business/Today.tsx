import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DayTimeline from '../../components/DayTimeline'
import ListSkeleton from '../../components/Skeleton'
import { bogotaDate, dayKey, formatDay, todayBogota, weekdayOf } from '../../lib/slots'
import { listHours, roomBusy, type Booking, type Room, type Venue } from '../../lib/venues'
import { useVenue } from './BusinessContext'
import BookingRow from './BookingRow'
import { useBookingBoard } from './useBookingBoard'

/** Una sala en el día de hoy: de un vistazo qué está ocupado, qué falta por confirmar y qué sigue libre. */
function RoomToday({ venue, room, today, pending }: { venue: Venue; room: Room; today: string; pending: Booking[] }) {
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venue.id], queryFn: () => listHours(venue.id) })
  const { data: taken = [] } = useQuery({ queryKey: ['busy', room.id, today], queryFn: () => roomBusy(room.id, bogotaDate(today, '00:00'), bogotaDate(today, '23:59')) })
  const day = hours.find((h) => h.weekday === weekdayOf(today))
  const busy = useMemo(() => taken.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })), [taken])
  const waiting = pending.filter((b) => b.roomId === room.id && dayKey(new Date(b.startsAt)) === today).map((b) => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) }))
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="li-title">{room.name}</div>
      {day ? <DayTimeline date={today} opens={day.opens} closes={day.closes} busy={busy} pending={waiting} /> : <p className="li-sub">Cerrado hoy.</p>}
    </div>
  )
}

/** Lo primero que ve el dueño: qué tiene que responder y qué pasa hoy en su ensayadero. */
export default function BusinessToday() {
  const venue = useVenue()
  const board = useBookingBoard(venue)
  const today = todayBogota(board.now)

  const sorted = [...board.confirmed].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const todays = sorted.filter((b) => dayKey(new Date(b.startsAt)) === today)
  const later = sorted.filter((b) => dayKey(new Date(b.startsAt)) > today)
  const week = later.filter((b) => new Date(b.startsAt).getTime() < board.now.getTime() + 7 * 86_400_000).length + todays.length

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{formatDay(board.now)}</span>
        <h1 className="page-title">Hoy</h1>
        <p className="page-sub">{venue.name}</p>
      </div>

      {!venue.isPublished && (
        <p className="notice" style={{ marginBottom: 14 }}>
          Tu ensayadero todavía no está publicado: las bandas no lo ven. <Link to="/mi-negocio/perfil" style={{ color: 'var(--amber)', fontWeight: 600 }}>Completar y publicar</Link>
        </p>
      )}

      <div className="stats">
        <div className="stat"><b>{board.pending.length}</b><span>Por responder</span></div>
        <div className="stat"><b>{todays.length}</b><span>Hoy</span></div>
        <div className="stat"><b>{week}</b><span>Esta semana</span></div>
      </div>
      {board.msg && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{board.msg}</p>}
      <div className="quick" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={board.addManual} disabled={board.rooms.length === 0}>Anotar una reserva</button>
        <Link className="btn" to="/mi-negocio/reservas">Ver todas las reservas</Link>
      </div>
      {board.rooms.length === 0 && <p className="li-sub wrap" style={{ marginTop: 8 }}>Primero agrega una sala en <Link to="/mi-negocio/salas" style={{ color: 'var(--amber)' }}>Salas</Link>.</p>}

      {board.isLoading && <ListSkeleton rows={3} />}

      <div className="section-title">Por responder{board.pending.length ? ` · ${board.pending.length}` : ''}</div>
      {board.pending.length === 0 && !board.isLoading && <p className="li-sub wrap">No hay solicitudes pendientes.{venue.autoConfirm ? ' Tu ensayadero confirma las reservas solo.' : ' Cuando una banda pida una franja, aparece aquí.'}</p>}
      <div className="list" style={{ borderTop: board.pending.length ? undefined : 0 }}>
        {board.pending.map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} />)}
      </div>

      {board.rooms.length > 0 && (
        <>
          <div className="section-title">Salas hoy</div>
          {board.rooms.map((r) => <RoomToday key={r.id} venue={venue} room={r} today={today} pending={board.pending} />)}
        </>
      )}

      <div className="section-title">Hoy</div>
      {todays.length === 0 && !board.isLoading && <p className="li-sub wrap">No hay ensayos hoy.</p>}
      <div className="list" style={{ borderTop: todays.length ? undefined : 0 }}>
        {todays.map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} showDay={false} />)}
      </div>

      {later.length > 0 && (
        <>
          <div className="section-title">Próximas</div>
          <div className="list">
            {later.slice(0, 4).map((b) => <BookingRow key={b.id} b={b} venue={venue} board={board} />)}
          </div>
          {later.length > 4 && <p className="li-sub" style={{ marginTop: 10 }}><Link to="/mi-negocio/reservas" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ver las {later.length - 4} restantes</Link></p>}
        </>
      )}
      {board.sheets}
    </>
  )
}
