import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg('')
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
    setBusy(false)
    if (error) {
      setMsg(
        /invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.'
        : /already registered/i.test(error.message) ? 'Ese correo ya tiene cuenta. Ingresa en su lugar.'
        : /rate limit/i.test(error.message) ? 'Demasiados intentos. Espera unos minutos.'
        : 'No pudimos completar eso. Revisa los datos e intenta de nuevo.',
      )
    } else if (mode === 'up' && !data.session) {
      setMsg('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego ingresa.')
    }
  }

  return (
    <main className="login">
      <div className="brand-big">back<span>line</span></div>
      <p className="page-sub">El lugar donde vive tu banda.</p>
      <form className="card login-form" onSubmit={submit}>
        <h1 className="login-title">{mode === 'in' ? 'Ingresar' : 'Crear cuenta'}</h1>
        {mode === 'up' && (
          <label className="field">Tu nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required />
          </label>
        )}
        <label className="field">Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />
        </label>
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Ingresar' : 'Crear cuenta'}</button>
        <button type="button" className="link-btn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
          {mode === 'in' ? '¿Primera vez? Crea tu cuenta' : '¿Ya tienes cuenta? Ingresa'}
        </button>
      </form>
    </main>
  )
}
