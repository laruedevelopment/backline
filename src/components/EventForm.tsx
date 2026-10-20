import { useState } from 'react'
import type { BandEvent } from '../lib/api'
import { toLocalInput } from '../lib/useEvents'
import { ask } from '../lib/confirm'
import Sheet from './Sheet'

type Draft = Omit<BandEvent, 'rsvps'>
type Props = {
  event?: BandEvent
  setlists: { id: string; name: string }[]
  onSave: (e: Draft) => Promise<unknown>
  onDelete?: () => Promise<unknown>
  onClose: () => void
}

const nextEvening = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(19, 0, 0, 0)
  return d.toISOString()
}

export default function EventForm({ event, setlists, onSave, onDelete, onClose }: Props) {
  const [kind, setKind] = useState<Draft['kind']>(event?.kind ?? 'rehearsal')
  const [title, setTitle] = useState(event?.title ?? '')
  const [place, setPlace] = useState(event?.place ?? '')
  const [when, setWhen] = useState(toLocalInput(event?.startsAt ?? nextEvening()))
  const [setlistId, setSetlistId] = useState(event?.setlistId ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const date = new Date(when)
    if (!title.trim()) return setError('Ponle un nombre al evento.')
    if (Number.isNaN(date.getTime())) return setError('Elige fecha y hora.')
    setBusy(true)
    setError('')
    try {
      await onSave({
        id: event?.id ?? crypto.randomUUID(), kind, title: title.trim(), place: place.trim(),
        startsAt: date.toISOString(), setlistId: setlistId || null, notes: notes.trim() || null,
      })
      onClose()
    } catch {
      setError('No pudimos guardarlo. Intenta de nuevo.')
      setBusy(false)
    }
  }

  async function del() {
    if (!onDelete || !(await ask({ title: `¿Borrar «${title}»?`, body: 'Se pierden también las confirmaciones de asistencia.', confirmLabel: 'Borrar' }))) return
    setBusy(true)
    try { await onDelete(); onClose() } catch { setError('No pudimos borrarlo. Intenta de nuevo.'); setBusy(false) }
  }

  return (
    <Sheet title={event ? 'Editar evento' : 'Nuevo evento'} onClose={onClose} onSubmit={submit}>
      <div className="tabs" role="group" aria-label="Tipo de evento">
        {([['rehearsal', 'Ensayo'], ['gig', 'Toque'], ['other', 'Otro']] as const).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={kind === v} className={kind === v ? 'active' : ''} onClick={() => setKind(v)}>{l}</button>
        ))}
      </div>
      <label className="field">Nombre
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'gig' ? 'Bar La Esquina' : 'Ensayo general'} maxLength={100} required />
      </label>
      <label className="field">Cuándo
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </label>
      <label className="field">Lugar
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Sala Resonancia" maxLength={120} />
      </label>
      <label className="field">Setlist
        <select value={setlistId} onChange={(e) => setSetlistId(e.target.value)}>
          <option value="">Sin setlist</option>
          {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="field">Notas (carga, montaje, pago…)
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </label>
      <div className="sheet-foot">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row">
          {onDelete && <button type="button" className="btn danger" disabled={busy} onClick={() => void del()}>Borrar</button>}
          <button className="btn primary grow" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Sheet>
  )
}
