import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBand, joinBand } from '../lib/api'
import { useBands } from '../store/useBandSession'

type Props = { onCancel?: () => void }

/** Crear una banda o unirse con código. Con onCancel se usa dentro de la app (otra banda); sin él, es el primer paso. */
export default function OnboardingPage({ onCancel }: Props) {
  const qc = useQueryClient()
  const { setActive } = useBands()
  const [mode, setMode] = useState<'new' | 'join'>('new')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false) // evita doble envío antes de que React pinte "busy"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMsg('')
    try {
      const id = mode === 'new' ? await createBand(name, city) : await joinBand(code)
      await qc.refetchQueries({ queryKey: ['bands'] })
      setActive(id)
      onCancel?.()
    } catch (err) {
      setMsg(/código/i.test(String((err as Error).message)) ? 'Ese código no existe o ya venció. Pide uno nuevo.' : 'No pudimos completarlo. Intenta de nuevo.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <main className={onCancel ? '' : 'login'}>
      {!onCancel && (
        <>
          <div className="brand-big">back<span>line</span></div>
          <p className="page-sub">Primero lo primero: tu banda.</p>
        </>
      )}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>Crear banda</button>
        <button role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Tengo un código</button>
      </div>
      <form className="card login-form" style={onCancel ? { maxWidth: 'none', marginTop: 12 } : undefined} onSubmit={submit}>
        {mode === 'new' ? (
          <>
            <label className="field">Nombre de la banda
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </label>
            <label className="field">Ciudad
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
            </label>
          </>
        ) : (
          <label className="field">Código de invitación
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} required autoFocus autoCapitalize="none" />
          </label>
        )}
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'new' ? 'Crear banda' : 'Unirme'}</button>
        {onCancel && <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>}
      </form>
    </main>
  )
}
