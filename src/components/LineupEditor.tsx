import { Plus, Trash2 } from 'lucide-react'
import { instrumentOptions } from '../lib/identity'
import type { Member } from '../lib/api'
import type { LineupSlot } from '../lib/song'
import InstrumentPicker from './InstrumentPicker'

type Props = {
  value: LineupSlot[]
  onChange: (v: LineupSlot[]) => void
  people: Member[]
  /** Invitados del setlist desde el que se edita (aparecen como opción). Sin esto no se pueden poner invitados. */
  guestNames?: string[]
  allowGuests?: boolean
  /** Botón «Llenar con la banda» cuando la lista está vacía. */
  fillFrom?: Member[]
}

/** Lista editable de «Quién toca»: instrumento + rol, y quién lo toca. La usan la canción y los ajustes de la banda. */
export default function LineupEditor({ value, onChange, people, guestNames = [], allowGuests = true, fillFrom = [] }: Props) {
  const setSlot = (i: number, p: Partial<LineupSlot>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <>
      {value.map((l, i) => (
        <div className="subform" key={i}>
          <div className="grid-row">
            <div className="grow"><InstrumentPicker label="Instrumento" value={l.instrument} onChange={(v) => setSlot(i, { instrument: v })} /></div>
            <label className="field grow">Quién
              <select value={l.profileId ?? (l.guest !== undefined ? (guestNames.includes(l.guest) ? `g:${l.guest}` : '__guest') : '')}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__guest') setSlot(i, { profileId: undefined, guest: l.guest && !guestNames.includes(l.guest) ? l.guest : '' })
                  else if (v.startsWith('g:')) setSlot(i, { profileId: undefined, guest: v.slice(2) })
                  else if (v) setSlot(i, { profileId: v, guest: undefined })
                  else setSlot(i, { profileId: undefined, guest: undefined })
                }}>
                <option value="">Sin asignar</option>
                {people.length > 0 && <optgroup label="La banda">{people.map((m) => <option key={m.profileId} value={m.profileId}>{m.name}{m.noAccount ? ' (sin cuenta)' : ''}</option>)}</optgroup>}
                {guestNames.length > 0 && <optgroup label="Invitados de este setlist">{guestNames.map((g) => <option key={g} value={`g:${g}`}>{g}</option>)}</optgroup>}
                {allowGuests && <option value="__guest">Otro invitado (escribir)…</option>}
              </select>
            </label>
            <button type="button" className="btn ghost icon" style={{ alignSelf: 'end' }} aria-label={`Quitar ${l.instrument || 'instrumento'} de quién toca`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
          {allowGuests && l.guest !== undefined && !l.profileId && !guestNames.includes(l.guest) && (
            <label className="field">Nombre del invitado
              <input value={l.guest} maxLength={60} placeholder="Camilo (trompeta)" onChange={(e) => setSlot(i, { guest: e.target.value })} />
            </label>
          )}
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn" onClick={() => onChange([...value, { instrument: instrumentOptions.find((o) => !value.some((x) => x.instrument === o)) ?? 'Guitarra' }])}>
          <Plus size={16} aria-hidden /> Agregar instrumento
        </button>
        {fillFrom.length > 0 && !value.length && (
          <button type="button" className="btn ghost" onClick={() => onChange(fillFrom.filter((m) => m.instrument || m.instruments[0]).map((m) => ({ instrument: m.instrument || m.instruments[0], profileId: m.profileId })))}>
            Llenar con la banda
          </button>
        )}
      </div>
    </>
  )
}
