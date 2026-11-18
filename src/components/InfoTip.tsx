import { useId, useState } from 'react'
import { Info } from 'lucide-react'

/** Botón de ayuda «i»: la explicación larga queda escondida hasta que se toca (menos texto en pantalla). */
export default function InfoTip({ text, label = 'Más información' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="infotip">
      <button type="button" className="infotip-btn" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}>
        <Info size={16} aria-hidden />
      </button>
      {open && <span id={id} role="note" className="info-pop">{text}</span>}
    </span>
  )
}

/** Una línea corta «¿Cómo funciona?» con su botón «i»: reemplaza los párrafos explicativos largos. */
export function HelpRow({ text, label = '¿Cómo funciona?' }: { text: string; label?: string }) {
  return (
    <div className="title-row help-row">
      <span className="li-sub">{label}</span>
      <InfoTip text={text} label={label} />
    </div>
  )
}
