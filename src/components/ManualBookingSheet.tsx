import { useState } from 'react'
import { bogotaDate, todayBogota } from '../lib/slots'
import { bookingError, ownerBooking, type Room } from '../lib/venues'
import Sheet from './Sheet'

const DURATIONS = [{ m: 60, l: '1 hora' }, { m: 90, l: '1 h 30' }, { m: 120, l: '2 horas' }, { m: 180, l: '3 horas' }, { m: 240, l: '4 horas' }, { m: 300, l: '5 horas' }]

/** El dueño anota una reserva que llegó por WhatsApp o llamada, para que las bandas vean la disponibilidad real. */
export default function ManualBookingSheet({ rooms, onSaved, onClose }: { rooms: Room[]; onSaved: () => Promise<unknown>; onClose: () => void }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [date, setDate] = useState(todayBogota())
  const [time, setTime] = useState('18:00')
  const [minutes, setMinutes] = useState(120)
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
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
        <label className="field">Salita
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </label>
      )}
      <div className="grid-row">
        <label className="field grow">Día
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field grow">Hora de inicio
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>
      <label className="field">Duración
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d.m} value={d.m}>{d.l}</option>)}</select>
      </label>
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
        <button className="btn primary block" disabled={busy || !roomId}>{busy ? 'Guardando…' : 'Anotar reserva'}</button>
      </div>
    </Sheet>
  )
}
