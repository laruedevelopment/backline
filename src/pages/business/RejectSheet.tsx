import { useState } from 'react'
import Sheet from '../../components/Sheet'
import { formatDay } from '../../lib/slots'
import type { Booking } from '../../lib/venues'

export default function RejectSheet({ booking, onClose, onReject }: { booking: Booking; onClose: () => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Sheet title="Rechazar solicitud" onClose={onClose} onSubmit={(e) => { e.preventDefault(); onReject(note.trim()) }}>
      <p className="li-sub wrap">{booking.contactName} · {booking.roomName} · {formatDay(new Date(booking.startsAt))}</p>
      <label className="field">Motivo (opcional, lo ve quien pidió)
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ese día hay mantenimiento. ¿Te sirve el jueves?" />
      </label>
      <button className="btn danger">Rechazar</button>
    </Sheet>
  )
}
