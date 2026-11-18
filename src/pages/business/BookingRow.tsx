import { googleCalendarUrl } from '../../lib/calendar'
import { waLink } from '../../lib/identity'
import { formatDay, formatTime } from '../../lib/slots'
import type { Booking, Venue } from '../../lib/venues'
import { useQuery } from '@tanstack/react-query'
import { money } from '../../lib/slots'
import { proofUrl } from '../../lib/venues'
import { statusLabel, type BookingBoard } from './useBookingBoard'

function Proof({ path }: { path: string }) {
  const { data } = useQuery({ queryKey: ['proof', path], queryFn: () => proofUrl(path), staleTime: 5 * 60_000 })
  if (!data) return <span className="li-sub">Cargando comprobante…</span>
  return <a href={data} target="_blank" rel="noopener noreferrer"><img src={data} alt="Comprobante de pago" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, border: '1px solid var(--line)' }} /></a>
}

/** Una reserva con sus datos de contacto y las acciones que correspondan a su estado. */
export default function BookingRow({ b, venue, board, showDay = true }: { b: Booking; venue: Venue; board: BookingBoard; showDay?: boolean }) {
  const s = new Date(b.startsAt), e = new Date(b.endsAt)
  const wa = b.contactPhone ? waLink(b.contactPhone, `Hola ${b.contactName}, te escribo de ${venue.name} sobre tu reserva del ${formatDay(s)}.`) : undefined
  return (
    <div className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="li-main" style={{ minWidth: 200 }}>
        <div className="li-title">{b.contactName || 'Banda sin nombre'} · {b.roomName}</div>
        {showDay && <div className="li-sub">{formatDay(s)}</div>}
        <div className="sub-row">
          <span className="mono">{formatTime(s)} a {formatTime(e)}</span>
          {b.bandId && <span>A nombre de una banda</span>}
          {b.source === 'owner' && <span className="tag">Anotada por ti</span>}
          {b.status === 'requested' && <span className="tag key">Por responder</span>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>WhatsApp</a>}
        </div>
        {b.payStatus !== 'not_required' && b.status === 'confirmed' && (
          <div className="li-sub wrap" style={{ marginTop: 4 }}>
            {b.payStatus === 'paid' && <span className="tag ok">Pagada · {money(b.depositAmount ?? 0)}{b.depositAmount !== b.totalAmount ? ` de ${money(b.totalAmount ?? 0)}` : ''}</span>}
            {b.payStatus === 'awaiting' && <>Esperando el pago de {money(b.depositAmount ?? 0)}{b.depositAmount !== b.totalAmount ? ` (total ${money(b.totalAmount ?? 0)})` : ''}{b.payDueAt ? ` hasta ${formatDay(new Date(b.payDueAt))} ${formatTime(new Date(b.payDueAt))}` : ''}</>}
            {b.payStatus === 'proof_sent' && <>Comprobante recibido por {money(b.depositAmount ?? 0)}. Revísalo y apruébalo.</>}
          </div>
        )}
        {b.payStatus === 'proof_sent' && b.proofPath && <Proof path={b.proofPath} />}
        {b.note && <div className="li-sub wrap">“{b.note}”</div>}
        {b.responseNote && <div className="li-sub wrap">Tu respuesta: {b.responseNote}</div>}
      </div>
      {b.status === 'requested' && (
        <div className="row" style={{ width: '100%', justifyContent: 'flex-end' }}>
          <button className="btn" disabled={board.busy} onClick={() => board.reject(b)}>Rechazar</button>
          <button className="btn primary" disabled={board.busy} onClick={() => board.confirm(b)}>Confirmar</button>
        </div>
      )}
      {b.status === 'cancelled' && b.payStatus === 'refund_due' && (
        <div style={{ width: '100%' }}>
          <p className="li-sub wrap"><b>Devolución pendiente:</b> esta reserva estaba pagada y se canceló. Devuelve el dinero según tu política de cancelación y márcalo aquí.</p>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" disabled={board.busy} onClick={() => board.refund(b, 'no_refund')}>No aplica devolución</button>
            <button className="btn primary" disabled={board.busy} onClick={() => board.refund(b, 'refunded')}>Ya devolví el dinero</button>
          </div>
        </div>
      )}
      {b.status === 'confirmed' && b.payStatus === 'proof_sent' && (
        <div className="row" style={{ width: '100%', justifyContent: 'flex-end' }}>
          <button className="btn" disabled={board.busy} onClick={() => board.rejectProof(b)}>Pedir otro comprobante</button>
          <button className="btn primary" disabled={board.busy} onClick={() => board.markPaid(b)}>Aprobar pago</button>
        </div>
      )}
      {b.status === 'confirmed' && b.payStatus === 'awaiting' && (
        <div className="row" style={{ width: '100%', justifyContent: 'flex-end' }}>
          <button className="btn" disabled={board.busy} onClick={() => board.markPaid(b)}>Ya pagó (marcar pagada)</button>
        </div>
      )}
      {b.status === 'confirmed' && new Date(b.endsAt) > board.now && (
        <div className="row" style={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <a className="btn" target="_blank" rel="noopener noreferrer" href={googleCalendarUrl({
            title: `${b.contactName} · ${b.roomName}`, start: s, end: e,
            location: `${venue.name}${venue.address ? `, ${venue.address}` : ''}`,
            details: [b.note, b.contactPhone && `Tel: ${b.contactPhone}`].filter(Boolean).join('\n'),
          })}>Agregar a Google Calendar</a>
          <button className="btn ghost danger" disabled={board.busy} onClick={() => void board.cancel(b)}>Cancelar</button>
        </div>
      )}
      {(b.status === 'rejected' || b.status === 'cancelled' || (b.status === 'confirmed' && new Date(b.endsAt) <= board.now)) && (
        <span className={`tag ${b.status === 'confirmed' ? 'ok' : ''}`}>{statusLabel[b.status]}</span>
      )}
    </div>
  )
}
