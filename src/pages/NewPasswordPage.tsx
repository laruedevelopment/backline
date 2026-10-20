import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

/** Pantalla a la que se llega desde el enlace del correo de recuperación. */
export default function NewPasswordPage() {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMsg('No pudimos cambiar la contraseña. Pide un enlace nuevo e intenta de nuevo.')
    else useAuth.setState({ recovery: false })
  }

  return (
    <main className="login">
      <header className="login-head"><div className="brand-big">back<span>line</span></div></header>
      <form className="login-form" onSubmit={submit}>
        <h1 className="login-title">Contraseña nueva</h1>
        <label className="field">Escribe tu contraseña nueva
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required autoFocus />
          <span className="li-sub">Mínimo 8 caracteres.</span>
        </label>
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
      </form>
    </main>
  )
}
