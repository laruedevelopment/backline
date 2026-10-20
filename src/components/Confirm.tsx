import { useState } from 'react'
import { useConfirmStore, type PendingConfirm } from '../lib/confirm'
import Sheet from './Sheet'

/** Se monta una sola vez en la raíz de la app. */
export function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending)
  if (!pending) return null
  return <ConfirmSheet key={pending.title} pending={pending} />
}

function ConfirmSheet({ pending }: { pending: PendingConfirm }) {
  const [typed, setTyped] = useState('')
  const done = (ok: boolean) => {
    useConfirmStore.setState({ pending: null })
    pending.resolve(ok)
  }
  const locked = !!pending.typeToConfirm && typed.trim() !== pending.typeToConfirm
  return (
    <Sheet title={pending.title} onClose={() => done(false)} dismissOnBackdrop>
      {pending.body && <p style={{ whiteSpace: 'pre-line' }}>{pending.body}</p>}
      {pending.typeToConfirm && (
        <label className="field">Escribe «{pending.typeToConfirm}» para confirmar
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
      <div className="row">
        <button className="btn grow" onClick={() => done(false)}>Cancelar</button>
        <button className="btn danger grow" disabled={locked} onClick={() => done(true)}>{pending.confirmLabel ?? 'Confirmar'}</button>
      </div>
    </Sheet>
  )
}
