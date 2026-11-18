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

/** Lista de instrumentos con los de la canción primero y la opción de escribir uno que no está («Guitarra Javi», «Trompeta»…). */
export default function InstrumentPicker({ value, onChange, first = [], includeAll, label }: Props) {
  const mine = [...new Set(first.map((f) => f.trim()).filter(Boolean))]
  const known = new Set([...(includeAll ? ['Todos'] : []), ...mine, ...instrumentOptions])
  const [custom, setCustom] = useState(!!value && !known.has(value))
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
