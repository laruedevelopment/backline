import { useState } from 'react'
import { reportContent, reportReasons, type ReportKind } from '../lib/reports'
import Sheet from './Sheet'

export type ReportTarget = { kind: ReportKind; id: string; label: string; excerpt?: string }

/** Hoja para denunciar contenido o a una persona. Se guarda con el motivo y un extracto, y se revisa a mano. */
export function ReportSheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [reason, setReason] = useState('acoso')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await reportContent(target.kind, target.id, reason, details, target.excerpt); setDone(true) } catch (err) {
      const msg = String((err as { message?: string })?.message ?? '')
      setError(/duplicate|unique/.test(msg) ? 'Ya denunciaste esto. Lo revisaremos.' : /demasiadas/.test(msg) ? 'Has enviado muchas denuncias seguidas. Intenta más tarde.' : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.')
    } finally { setBusy(false) }
  }

  return (
    <Sheet title={done ? 'Gracias' : `Denunciar ${target.label}`} onClose={onClose} onSubmit={submit}>
      {done ? (
        <>
          <p>Recibimos tu denuncia y la revisaremos. Si no quieres ver más a esa persona, puedes bloquearla desde su perfil o desde la conversación.</p>
          <div className="sheet-foot"><button type="button" className="btn primary block" onClick={onClose}>Listo</button></div>
        </>
      ) : (
        <>
          <p className="li-sub wrap">Cuéntanos qué pasa. La denuncia es privada: la otra persona no se entera.</p>
          <fieldset className="share-fields">
            {reportReasons.map(([v, l]) => (
              <label key={v} className="check-row"><input type="radio" name="reason" checked={reason === v} onChange={() => setReason(v)} /> {l}</label>
            ))}
          </fieldset>
          <label className="field">Detalles (opcional)
            <textarea rows={3} value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sheet-foot"><div className="row"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary grow" disabled={busy}>{busy ? 'Enviando…' : 'Enviar denuncia'}</button></div></div>
        </>
      )}
    </Sheet>
  )
}
