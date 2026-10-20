import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBand, joinBand } from '../lib/api'

export default function OnboardingPage() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'new' | 'join'>('new')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      if (mode === 'new') await createBand(name, city)
      else await joinBand(code)
      await qc.invalidateQueries({ queryKey: ['bands'] })
    } catch (err) {
      setMsg(/código/i.test(String((err as Error).message)) ? 'Ese código no existe o ya venció. Pide uno nuevo.' : 'No pudimos completarlo. Intenta de nuevo.')
    }
    setBusy(false)
  }

  return (
    <main className="login">
      <div className="brand-big">back<span>line</span></div>
      <p className="page-sub">Primero lo primero: tu banda.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>Crear banda</button>
        <button role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Tengo un código</button>
      </div>
      <form className="card login-form" onSubmit={submit}>
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
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} required autoFocus autoCapitalize="none" />
          </label>
        )}
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'new' ? 'Crear banda' : 'Unirme'}</button>
      </form>
    </main>
  )
}
