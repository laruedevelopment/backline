import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bogotaDate, buildSlots, formatTime, todayBogota, weekdayOf } from '../lib/slots'
import { bookingError, listHours, ownerBooking, roomBusy, type Booking, type Room } from '../lib/venues'
import DayTimeline from './DayTimeline'
import Sheet from './Sheet'

const DURATIONS = [{ m: 60, l: '1 hora' }, { m: 90, l: '1 h 30' }, { m: 120, l: '2 horas' }, { m: 180, l: '3 horas' }, { m: 240, l: '4 horas' }, { m: 300, l: '5 horas' }]

/** El dueño anota una reserva que llegó por WhatsApp o llamada, para que las bandas vean la disponibilidad real. */
type Props = { venueId: string; rooms: Room[]; bookings?: Booking[]; onSaved: () => Promise<unknown>; onClose: () => void }

export default function ManualBookingSheet({ venueId, rooms, bookings = [], onSaved, onClose }: Props) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [date, setDate] = useState(todayBogota())
  const [time, setTime] = useState('')
  const [minutes, setMinutes] = useState(120)
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venueId], queryFn: () => listHours(venueId) })
  const day = hours.find((h) => h.weekday === weekdayOf(date))
  const { data: taken = [] } = useQuery({
    queryKey: ['busy', roomId, date],
    queryFn: () => roomBusy(roomId, bogotaDate(date, '00:00'), bogotaDate(date, '23:59')),
    enabled: !!roomId,
  })
  const busyBlocks = useMemo(() => taken.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })), [taken])
  const pendingBlocks = useMemo(() => bookings
    .filter((b) => b.status === 'requested' && b.roomId === roomId)
    .map((b) => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) }))
    .filter((b) => b.start.getTime() < bogotaDate(date, '23:59').getTime() && b.end.getTime() > bogotaDate(date, '00:00').getTime()), [bookings, roomId, date])
  // El dueño puede anotar una reserva que ya empezó (lead 0).
  const slots = useMemo(() => (day ? buildSlots({ date, opens: day.opens, closes: day.closes, minutes, busy: taken, step: 30, lead: -24 * 60 }) : []), [day, date, minutes, taken])
  const chosen = time ? { start: bogotaDate(date, time), end: new Date(bogotaDate(date, time).getTime() + minutes * 60_000) } : null
  const clash = !!chosen && busyBlocks.some((b) => b.start < chosen.end && b.end > chosen.start)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !time || clash) return
    const start = bogotaDate(date, time)
    const end = new Date(start.getTime() + minutes * 60_000)
    setBusy(true)
    setError('')
    try {
      await ownerBooking({ roomId, start, end, label: label.trim(), phone: phone.trim(), note: note.trim() })
      await onSaved()
      onClose()
    } catch (err) {
      setError(bookingError(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title="Anotar una reserva" onClose={onClose} onSubmit={submit}>
      <p className="li-sub wrap">Para las reservas que te llegan por WhatsApp o por llamada. Queda confirmada y esa franja deja de aparecer libre para las bandas.</p>
      {rooms.length > 1 && (
        <label className="field">Sala
          <select value={roomId} onChange={(e) => { setRoomId(e.target.value); setTime('') }}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </label>
      )}
      <label className="field">Día
        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} required />
      </label>
      <label className="field">Duración
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d.m} value={d.m}>{d.l}</option>)}</select>
      </label>

      <div className="field">
        <span>Disponibilidad{day ? '' : ' · cerrado ese día'}</span>
        {day ? (
          <>
            <DayTimeline date={date} opens={day.opens} closes={day.closes} busy={busyBlocks} pending={pendingBlocks} chosen={chosen} />
            <div className="slots" role="group" aria-label="Hora de inicio" style={{ marginTop: 10 }}>
              {slots.map((sl) => (
                <button type="button" key={sl.start.getTime()} className={`slot${time && sl.start.getTime() === chosen?.start.getTime() ? ' on' : ''}`} disabled={!sl.free}
                  onClick={() => setTime(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }).format(sl.start))}>
                  {formatTime(sl.start).replace(/\s?([ap])\.\s?m\./i, (_, x) => ` ${x.toLowerCase()}m`)}
                </button>
              ))}
            </div>
            {slots.length > 0 && !slots.some((sl) => sl.free) && <p className="li-sub wrap">No queda ninguna franja libre de {DURATIONS.find((d) => d.m === minutes)?.l} ese día. Prueba con menos tiempo u otra sala.</p>}
          </>
        ) : (
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora de inicio" />
        )}
      </div>
      <label className="field">Nombre de la banda o de quien reservó
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} required placeholder="Los Chinos" />
      </label>
      <label className="field">WhatsApp (opcional)
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="300 123 4567" />
      </label>
      <label className="field">Nota (opcional)
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Pagó el 50 %." />
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        {clash && <p className="form-error" role="alert">Esa hora se cruza con otra reserva.</p>}
        <button className="btn primary block" disabled={busy || !roomId || !time || clash}>{busy ? 'Guardando…' : chosen ? `Anotar ${formatTime(chosen.start)} – ${formatTime(chosen.end)}` : 'Elige una hora'}</button>
      </div>
    </Sheet>
  )
}
