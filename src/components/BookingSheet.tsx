import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { waLink } from '../lib/identity'
import { bogotaDate, buildSlots, formatDay, formatTime, money, todayBogota, weekdayOf, type Slot } from '../lib/slots'
import { bookingError, requestBooking, roomBusy, type Hours, type Room, type Venue } from '../lib/venues'
import { useBands } from '../store/useBandSession'
import { useAuth } from '../store/useAuth'
import Sheet from './Sheet'

const APP_URL = typeof window === 'undefined' ? '' : `${window.location.origin}${import.meta.env.BASE_URL}`
const DURATIONS = [{ m: 60, l: '1 hora' }, { m: 90, l: '1 h 30' }, { m: 120, l: '2 horas' }, { m: 180, l: '3 horas' }, { m: 240, l: '4 horas' }]

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00-05:00`)
  d.setUTCDate(d.getUTCDate() + n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

type Props = { venue: Venue; rooms: Room[]; hours: Hours[]; initialRoomId?: string; onClose: () => void }

/** Pedir una franja: sala → día → duración → hora libre. El dueño confirma o rechaza. */
export default function BookingSheet({ venue, rooms, hours, initialRoomId, onClose }: Props) {
  const qc = useQueryClient()
  const { bands } = useBands()
  const userId = useAuth((s) => s.session?.user.id)
  const editableBands = bands.filter((b) => b.role !== 'guest')

  const today = todayBogota()
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? '')
  const [date, setDate] = useState(addDays(today, 1))
  const [minutes, setMinutes] = useState(120)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [bandId, setBandId] = useState<string>(editableBands[0]?.id ?? '')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const room = rooms.find((r) => r.id === roomId)
  const day = hours.find((h) => h.weekday === weekdayOf(date))

  const { data: busy = [], isLoading } = useQuery({
    queryKey: ['busy', roomId, date],
    queryFn: () => roomBusy(roomId, bogotaDate(date, '00:00'), bogotaDate(date, '23:59')),
    enabled: !!roomId && !!day,
  })

  const slots = useMemo(() => (day ? buildSlots({ date, opens: day.opens, closes: day.closes, minutes, busy }) : []), [day, date, minutes, busy])
  const free = slots.filter((s) => s.free).length

  const book = useMutation({
    mutationFn: () => requestBooking({ roomId, start: slot!.start, end: slot!.end, bandId: bandId || null, note: note.trim(), phone: phone.trim() }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['my-bookings'] }), qc.invalidateQueries({ queryKey: ['busy'] })])
      setDone(true)
    },
    onError: (e) => setError(bookingError(e)),
  })

  const total = room && slot ? Math.round((room.pricePerHour * minutes) / 60) : 0
  const wa = venue.whatsapp && slot
    ? waLink(venue.whatsapp, `Hola, acabo de pedir ${room?.name} para el ${formatDay(slot.start)}, de ${formatTime(slot.start)} a ${formatTime(slot.end)}. Puedes confirmarla en Backline: ${APP_URL}mi-sala`)
    : undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!slot || book.isPending) return
    setError('')
    book.mutate()
  }

  if (done && slot) {
    return (
      <Sheet title="Solicitud enviada" onClose={onClose} dismissOnBackdrop>
        <p><b>{venue.name} · {room?.name}</b></p>
        <p>{formatDay(slot.start)}, de {formatTime(slot.start)} a {formatTime(slot.end)}</p>
        <p className="li-sub wrap">La sala responderá la solicitud. Verás el estado en «Mis reservas»{bandId ? ' y, cuando la confirmen, el ensayo aparecerá solo en la agenda de tu banda' : ''}.</p>
        {wa && <a className="btn primary" href={wa} target="_blank" rel="noopener noreferrer">Avisarles por WhatsApp</a>}
        {wa && <p className="li-sub wrap">Escríbeles para que sepan que hay una solicitud nueva: así la ven rápido.</p>}
        <button className="btn" onClick={onClose}>Listo</button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Reservar" onClose={onClose} onSubmit={submit}>
      <p className="li-sub wrap">{venue.name}</p>

      {rooms.length > 1 && (
        <label className="field">Salita
          <select value={roomId} onChange={(e) => { setRoomId(e.target.value); setSlot(null) }}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} · hasta {r.capacity} personas · {money(r.pricePerHour)}{r.pricePerHour ? '/h' : ''}</option>)}
          </select>
        </label>
      )}
      <div className="grid-row">
        <label className="field grow">Día
          <input type="date" value={date} min={today} max={addDays(today, 120)} onChange={(e) => { setDate(e.target.value); setSlot(null) }} required />
        </label>
        <label className="field grow">Duración
          <select value={minutes} onChange={(e) => { setMinutes(Number(e.target.value)); setSlot(null) }}>
            {DURATIONS.map((d) => <option key={d.m} value={d.m}>{d.l}</option>)}
          </select>
        </label>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Horas disponibles</div>
        {!day && <p className="li-sub wrap">La sala está cerrada ese día. Prueba con otro.</p>}
        {day && isLoading && <p className="li-sub">Buscando franjas…</p>}
        {day && !isLoading && slots.length === 0 && <p className="li-sub wrap">No hay franjas de esa duración en el horario de ese día.</p>}
        {day && !isLoading && slots.length > 0 && free === 0 && <p className="li-sub wrap">Todo está ocupado ese día. Prueba con otro.</p>}
        <div className="slots" role="group" aria-label="Horas disponibles">
          {slots.map((s) => (
            <button key={s.start.toISOString()} type="button" className={`slot ${slot?.start.getTime() === s.start.getTime() ? 'on' : ''}`}
              disabled={!s.free} aria-pressed={slot?.start.getTime() === s.start.getTime()} aria-label={`${formatTime(s.start)} a ${formatTime(s.end)}${s.free ? '' : ', ocupada'}`}
              onClick={() => setSlot(s)}>
              {formatTime(s.start)}
            </button>
          ))}
        </div>
        {slot && <p className="notice" style={{ marginTop: 10 }}>{formatTime(slot.start)} a {formatTime(slot.end)}{total > 0 ? ` · ${money(total)} en total (se paga en la sala)` : ''}</p>}
      </div>

      {editableBands.length > 0 && (
        <label className="field">A nombre de
          <select value={bandId} onChange={(e) => setBandId(e.target.value)}>
            {editableBands.map((b) => <option key={b.id} value={b.id}>{b.name} (se agrega a su agenda)</option>)}
            <option value="">Solo a mi nombre</option>
          </select>
        </label>
      )}
      <label className="field">Tu WhatsApp (opcional)
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="300 123 4567" autoComplete="tel" />
      </label>
      <label className="field">Nota para la sala (opcional)
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Somos 4. Llevamos nuestra batería." />
      </label>
      <p className="li-sub wrap">Compartimos tu nombre{phone.trim() ? ' y tu teléfono' : ''} con la sala para que pueda confirmarte. No se hace ningún cobro en Backline.</p>

      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={!slot || book.isPending || !userId}>{book.isPending ? 'Enviando…' : slot ? 'Pedir esta franja' : 'Elige una hora'}</button>
      </div>
    </Sheet>
  )
}
