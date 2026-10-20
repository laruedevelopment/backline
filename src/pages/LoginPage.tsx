import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'in' | 'up' | 'reset'
const titles: Record<Mode, string> = { in: 'Ingresar', up: 'Crear cuenta', reset: 'Recuperar contraseña' }

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const go = (m: Mode) => { setMode(m); setMsg(null) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setMsg(null)
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` })
      setBusy(false)
      // Misma respuesta exista o no la cuenta: no se revela quién está registrado.
      setMsg(error && /rate limit/i.test(error.message)
        ? { kind: 'error', text: 'Demasiados intentos. Espera unos minutos.' }
        : { kind: 'ok', text: 'Si ese correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva.' })
      return
    }
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
    setBusy(false)
    if (error) {
      setMsg({
        kind: 'error',
        text: /invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.'
          : /already registered/i.test(error.message) ? 'Ese correo ya tiene cuenta. Ingresa en su lugar.'
          : /rate limit/i.test(error.message) ? 'Demasiados intentos. Espera unos minutos.'
          : 'No pudimos completar eso. Revisa los datos e intenta de nuevo.',
      })
    } else if (mode === 'up' && !data.session) {
      setMsg({ kind: 'ok', text: 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego ingresa.' })
    }
  }

  return (
    <main className="login">
      <div className="brand-big">back<span>line</span></div>
      <p className="page-sub">El lugar donde vive tu banda.</p>
      <form className="card login-form" onSubmit={submit}>
        <h1 className="login-title">{titles[mode]}</h1>
        {mode === 'up' && (
          <label className="field">Tu nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required />
          </label>
        )}
        <label className="field">Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== 'reset' && (
          <label className="field">Contraseña
            <div className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />
              <button type="button" className="link-btn" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Ver'}</button>
            </div>
            {mode === 'up' && <span className="li-sub">Mínimo 8 caracteres.</span>}
          </label>
        )}
        {msg && <p className={msg.kind === 'ok' ? 'form-ok' : 'form-error'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Ingresar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}</button>
        {mode === 'in' && <button type="button" className="link-btn" onClick={() => go('reset')}>Olvidé mi contraseña</button>}
        <button type="button" className="link-btn" onClick={() => go(mode === 'up' || mode === 'reset' ? 'in' : 'up')}>
          {mode === 'in' ? '¿Primera vez? Crea tu cuenta' : mode === 'up' ? '¿Ya tienes cuenta? Ingresa' : 'Volver a ingresar'}
        </button>
      </form>
    </main>
  )
}
