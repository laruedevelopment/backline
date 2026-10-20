import { useId, useState } from 'react'
import { canonicalCity, normCity, suggestCities } from '../lib/cities'

type Props = {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  required?: boolean
  ariaLabel?: string
  /** En un filtro se aplica al escribir; en un formulario se normaliza al salir del campo. */
  live?: boolean
  autoComplete?: string
}

/** Campo de ciudad con sugerencias: elegir de la lista evita errores de escritura y ciudades repetidas con distinta forma. */
export default function CityInput({ value, onChange, placeholder = 'Ciudad', required, ariaLabel, live }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const options = suggestCities(value)
  const exact = options.some((o) => normCity(o.name) === normCity(value))

  const pick = (name: string) => { onChange(name); setOpen(false) }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); pick(options[active].name) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="combo">
      <input
        role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-label={ariaLabel}
        value={value} placeholder={placeholder} required={required} maxLength={80} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); if (!live && value.trim()) onChange(canonicalCity(value)) }}
        onKeyDown={onKey}
      />
      {open && options.length > 0 && !(exact && options.length === 1) && (
        <ul id={id} role="listbox" className="combo-list">
          {options.map((o, i) => (
            // onMouseDown evita que el campo pierda el foco antes de elegir.
            <li key={o.name} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); pick(o.name) }}>
              {o.name} <span className="li-sub">{o.area}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
