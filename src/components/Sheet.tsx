import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type Props = {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Si se pasa, la hoja es un <form>. */
  onSubmit?: (e: React.FormEvent) => void
  /** Cerrar al tocar el fondo. Se apaga en formularios para no perder lo escrito. */
  dismissOnBackdrop?: boolean
  hideTitle?: boolean
}

/** Hoja inferior accesible: atrapa el foco, cierra con Escape y devuelve el foco a quien la abrió. */
export default function Sheet({ title, onClose, children, onSubmit, dismissOnBackdrop = false, hideTitle }: Props) {
  const ref = useRef<HTMLDivElement & HTMLFormElement>(null)
  const titleId = useId()
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('input, textarea, select') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const firstEl = items[0], lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [])

  const Tag = (onSubmit ? 'form' : 'div') as 'div'
  // Portal al <body>: si un ancestro tiene backdrop-filter/transform, un `fixed` quedaría atrapado dentro de él.
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => dismissOnBackdrop && e.target === e.currentTarget && onClose()}>
      <Tag ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onSubmit={onSubmit as never}>
        <div className="row">
          <h2 id={titleId} className={`grow ${hideTitle ? 'sr-only' : ''}`}>{title}</h2>
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><X size={20} aria-hidden /></button>
        </div>
        {children}
      </Tag>
    </div>,
    document.body,
  )
}
