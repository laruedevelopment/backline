import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBand, joinBand } from '../lib/api'
import { useBands } from '../store/useBandSession'
import CityInput from '../components/CityInput'

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
    <main className={onCancel ? 'stack' : 'login'}>
      {!onCancel && (
        <header className="login-head">
          <div className="brand-big">back<span>line</span></div>
          <p className="login-tag">Primero lo primero: tu banda. Créala o únete con el código que te pasaron.</p>
        </header>
      )}
      <div className="seg" role="group" aria-label="Qué quieres hacer" style={onCancel ? undefined : { alignSelf: 'center' }}>
        <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Crear banda</button>
        <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Tengo un código</button>
      </div>
      <form className={`login-form ${onCancel ? 'flat' : ''}`} onSubmit={submit}>
        {mode === 'new' ? (
          <>
            <label className="field">Nombre de la banda
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </label>
            <label className="field">Ciudad
              <CityInput value={city} onChange={setCity} />
            </label>
          </>
        ) : (
          <label className="field">Código de invitación
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} required autoFocus autoCapitalize="none" />
          </label>
        )}
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Un momento…' : mode === 'new' ? 'Crear banda' : 'Unirme'}</button>
        {onCancel && <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>}
      </form>
    </main>
  )
}
