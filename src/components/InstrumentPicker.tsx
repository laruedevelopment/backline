import { useState } from 'react'
import { instrumentOptions } from '../lib/identity'

type Props = {
  value: string
  onChange: (v: string) => void
  /** Los instrumentos que ya lleva esta canción: salen primero. */
  first?: string[]
  /** Agrega «Todos» (para afinaciones de toda la banda). */
  includeAll?: boolean
  label: string
}

const CUSTOM = '__custom'
const GUITAR_ROLES = ['líder', 'rítmica', 'acústica', 'solista', '1', '2', '3']
const ROLES: Record<string, string[]> = {
  Guitarra: GUITAR_ROLES, Bajo: ['5 cuerdas', 'sintetizador', '1', '2'], Voz: ['principal', 'coros', 'segunda voz'],
  'Teclado / piano': ['piano', 'sintetizador', 'órgano', '1', '2'], Percusión: ['latina', 'electrónica', '1', '2'],
}
const baseOf = (v: string) => Object.keys(ROLES).concat(instrumentOptions).find((b) => b !== 'Otro' && (v === b || v.startsWith(b + ' '))) ?? ''

/** Lista de instrumentos con los de la canción primero y la opción de escribir uno que no está («Guitarra Javi», «Trompeta»…). */
export default function InstrumentPicker({ value, onChange, first = [], includeAll, label }: Props) {
  const mineAll = [...new Set(first.map((f) => f.trim()).filter(Boolean))]
  const knownAll = new Set([...(includeAll ? ['Todos'] : []), ...mineAll, ...instrumentOptions])
  const [custom, setCustom] = useState(!!value && !knownAll.has(value))
  // Para armar la formación: instrumento + rol por separado («Guitarra» + «líder», «Guitarra 2»…). Se guarda junto: «Guitarra líder».
  if (!includeAll && first.length === 0) {
    const base = baseOf(value)
    const role = base ? value.slice(base.length).trim() : ''
    const roles = ROLES[base] ?? []
    const isCustom = !!value && !base
    return (
      <div className="field-pair">
        <label className="field">{label}
          <select value={isCustom ? CUSTOM : base} onChange={(e) => { const v = e.target.value; onChange(v === CUSTOM ? ' ' : v) }}>
            {!base && !isCustom && <option value="">Elige…</option>}
            {instrumentOptions.filter((o) => o !== 'Otro').map((o) => <option key={o} value={o}>{o}</option>)}
            <option value={CUSTOM}>Otro (escribir)…</option>
          </select>
          {isCustom && <input value={value.trimStart()} maxLength={30} placeholder="Por ejemplo: Trompeta" autoFocus onChange={(e) => onChange(e.target.value || ' ')} />}
        </label>
        {roles.length > 0 && (
          <label className="field">Rol
            <select value={role} onChange={(e) => onChange(e.target.value ? `${base} ${e.target.value}` : base)}>
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </select>
          </label>
        )}
      </div>
    )
  }
  const mine = mineAll
  return (
    <label className="field">{label}
      <select value={custom ? CUSTOM : value} onChange={(e) => { if (e.target.value === CUSTOM) { setCustom(true); onChange('') } else { setCustom(false); onChange(e.target.value) } }}>
        {!custom && !value && <option value="">Elige…</option>}
        {includeAll && <option value="Todos">Todos</option>}
        {mine.length > 0 && <optgroup label="En esta canción">{mine.map((o) => <option key={o} value={o}>{o}</option>)}</optgroup>}
        <optgroup label="Otros instrumentos">{instrumentOptions.filter((o) => !mine.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}</optgroup>
        <option value={CUSTOM}>Otro (escribir)…</option>
      </select>
      {custom && <input value={value} maxLength={30} placeholder="Por ejemplo: Trompeta, Guitarra 2" autoFocus onChange={(e) => onChange(e.target.value)} />}
    </label>
  )
}
