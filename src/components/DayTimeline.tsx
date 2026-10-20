import { bogotaDate, formatTime } from '../lib/slots'

type Block = { start: Date; end: Date }
type Props = {
  date: string
  opens: string
  closes: string
  /** Franjas ya ocupadas (reservas confirmadas y calendario externo). */
  busy: Block[]
  /** Solicitudes pendientes de respuesta: se ven distinto, todavía no bloquean. */
  pending?: Block[]
  /** La franja que se está eligiendo. */
  chosen?: Block | null
}

const hourLabel = (d: Date) => formatTime(d).replace(':00', '').replace(/\s/g, ' ').replace(/ ?([ap])\. ?m\./i, (_, x: string) => x.toLowerCase())

/** Barra del día, de apertura a cierre: lo ocupado en rojo, lo pendiente rayado y la elegida en ámbar. */
export default function DayTimeline({ date, opens, closes, busy, pending = [], chosen }: Props) {
  const open = bogotaDate(date, opens).getTime()
  const close = bogotaDate(date, closes).getTime()
  const span = close - open
  if (span <= 0) return null
  const pos = (b: Block) => {
    const a = Math.max(open, b.start.getTime()), z = Math.min(close, b.end.getTime())
    return z > a ? { left: `${((a - open) / span) * 100}%`, width: `${((z - a) / span) * 100}%` } : null
  }
  const ticks: Date[] = []
  for (let t = Math.ceil(open / 3_600_000) * 3_600_000; t < close; t += 3_600_000) ticks.push(new Date(t))
  const every = ticks.length > 10 ? 2 : 1
  const labelEvery = ticks.length > 8 ? 3 : 2

  return (
    <div className="timeline" role="img" aria-label={`Disponibilidad de ${formatTime(new Date(open))} a ${formatTime(new Date(close))}. ${busy.length} franjas ocupadas.`}>
      <div className="timeline-bar">
        {ticks.map((t, i) => i % every === 0 && <span key={t.getTime()} className="timeline-tick" style={{ left: `${((t.getTime() - open) / span) * 100}%` }} />)}
        {pending.map((b, i) => { const p = pos(b); return p && <span key={`p${i}`} className="timeline-block pending" style={p} /> })}
        {busy.map((b, i) => { const p = pos(b); return p && <span key={`b${i}`} className="timeline-block busy" style={p} /> })}
        {chosen && (() => { const p = pos(chosen); return p && <span className="timeline-block chosen" style={p} /> })()}
      </div>
      <div className="timeline-scale" aria-hidden>
        {ticks.map((t, i) => i % labelEvery === 0 && <span key={t.getTime()} style={{ left: `${((t.getTime() - open) / span) * 100}%` }}>{hourLabel(t)}</span>)}
      </div>
      <div className="timeline-legend">
        <span><i className="dot free" /> Libre</span>
        <span><i className="dot busy" /> Ocupada</span>
        {pending.length > 0 && <span><i className="dot pending" /> Por confirmar</span>}
        {chosen && <span><i className="dot chosen" /> La que anotas</span>}
      </div>
    </div>
  )
}
