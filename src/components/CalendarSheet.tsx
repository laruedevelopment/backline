import { useState } from 'react'
import { cleanIcalUrl } from '../lib/calendar'
import { removeCalendarSource, saveCalendarSource, syncCalendars, type CalendarSource, type Room } from '../lib/venues'
import { ask } from '../lib/confirm'
import Sheet from './Sheet'

/** Conectar el Google Calendar de una sala: lo que el dueño ya escribe allí bloquea esas horas en Backline. */
export default function CalendarSheet({ venueId, room, otherRooms, source, onChanged, onClose }: {
  venueId: string; room: Room; otherRooms: Room[]; source?: CalendarSource; onChanged: () => Promise<unknown>; onClose: () => void
}) {
  const [url, setUrl] = useState(source?.url ?? '')
  const [all, setAll] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const clean = cleanIcalUrl(url)
    if (!clean) return setError('Esa no parece la «Dirección secreta en formato iCal» de Google Calendar. Debe empezar por https://calendar.google.com/calendar/ical/ y terminar en basic.ics')
    setBusy(true)
    setError('')
    try {
      const targets = all ? [room, ...otherRooms] : [room]
      for (const r of targets) await saveCalendarSource(venueId, r.id, clean)
      await syncCalendars(venueId, true)
      await onChanged()
      onClose()
    } catch {
      setError('No pudimos guardar el calendario. Intenta de nuevo.')
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!(await ask({ title: '¿Desconectar el calendario?', body: 'Las horas que venían de Google Calendar dejan de bloquearse en Backline.', confirmLabel: 'Desconectar' }))) return
    setBusy(true)
    try { await removeCalendarSource(room.id); await syncCalendars(venueId, true); await onChanged(); onClose() } catch { setError('No pudimos desconectarlo. Intenta de nuevo.'); setBusy(false) }
  }

  return (
    <Sheet title={`Calendario de ${room.name}`} onClose={onClose} onSubmit={submit}>
      <p className="li-sub wrap">Lo que escribes en tu Google Calendar bloquea esas horas en Backline, sin anotarlo dos veces. Se actualiza solo, cada vez que alguien va a reservar.</p>
      <ol className="steps" style={{ gap: 8 }}>
        <li>Abre Google Calendar en el computador.</li>
        <li>Pasa el mouse sobre el calendario de esta sala, toca los tres puntos y elige «Configuración y uso compartido».</li>
        <li>Baja hasta «Integrar el calendario» y copia la «Dirección secreta en formato iCal».</li>
        <li>Pégala aquí.</li>
      </ol>
      <label className="field">Dirección secreta en formato iCal
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      </label>
      {otherRooms.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          <span>Usar este mismo calendario en las demás salas (si llevas todas en un solo calendario).</span>
        </label>
      )}
      <p className="notice">Backline guarda solo las horas ocupadas: no ve ni guarda los títulos ni los detalles de tus eventos. No compartas esa dirección con nadie; si se filtra, puedes restablecerla en Google.</p>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {source && <button type="button" className="btn danger" disabled={busy} onClick={() => void disconnect()}>Desconectar</button>}
          <button className="btn primary grow" disabled={busy}>{busy ? 'Conectando…' : source ? 'Guardar' : 'Conectar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
