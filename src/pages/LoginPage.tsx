import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL, RESPONSIBLE, TERMS_VERSION } from '../content/legal'
import { readPendingInvite } from '../lib/pendingInvite'
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
  const [consentData, setConsentData] = useState(false)
  const [consentTerms, setConsentTerms] = useState(false)
  const [age, setAge] = useState<'' | 'adult' | 'minor_with_consent'>('')
  const canSignUp = consentData && consentTerms && age !== ''

  const go = (m: Mode) => { setMode(m); setMsg(null) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    if (mode === 'up' && !canSignUp) return
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
        : await supabase.auth.signUp({ email, password, options: { data: { name: name.trim(), terms_version: TERMS_VERSION, age_declaration: age } } })
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
      <header className="login-head">
        <div className="brand-big">back<span>line</span></div>
        <p className="login-tag">Repertorio, setlists y ensayos de tu banda, en un solo lugar.</p>
        {readPendingInvite() && <p className="notice" role="status" style={{ textAlign: 'left' }}>Te invitaron a una banda. Crea tu cuenta o ingresa y entrarás a ella automáticamente.</p>}
      </header>

      <form className="login-form" onSubmit={submit}>
        <h1 className="login-title">{titles[mode]}</h1>
        {mode === 'reset' && <p className="li-sub wrap">Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</p>}

        {mode === 'up' && (
          <label className="field">Tu nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="Cómo te dicen en la banda" required />
          </label>
        )}
        <label className="field">Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tucorreo@ejemplo.com" required />
        </label>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="pw">Contraseña</label>
            <div className="pw">
              <input id="pw" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder={mode === 'up' ? 'Mínimo 8 caracteres' : ''} required />
              <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Ver'}</button>
            </div>
            {mode === 'in' && <button type="button" className="text-link" onClick={() => go('reset')}>Olvidé mi contraseña</button>}
          </div>
        )}

        {mode === 'up' && (
          <div className="consent">
            <label className="check-row">
              <input type="checkbox" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} />
              <span>
                Autorizo a Backline ({RESPONSIBLE}, {CONTACT_EMAIL}) a tratar mis datos personales para crear mi cuenta y compartir información con mi banda, según la{' '}
                <Link to="/privacidad" target="_blank" rel="noopener">Política de privacidad</Link>. Sé que se guardan con Supabase fuera de Colombia y que puedo conocer, actualizar, rectificar y suprimir mis datos, o revocar esta autorización, escribiendo a ese correo o borrando mi cuenta en Perfil.
              </span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
              <span>Acepto los <Link to="/terminos" target="_blank" rel="noopener">Términos de uso</Link>.</span>
            </label>
            <fieldset className="radio-group" style={{ border: 0, padding: 0 }}>
              <legend>Mi edad</legend>
              <label className="check-row">
                <input type="radio" name="age" checked={age === 'adult'} onChange={() => setAge('adult')} />
                <span>Tengo 18 años o más.</span>
              </label>
              <label className="check-row">
                <input type="radio" name="age" checked={age === 'minor_with_consent'} onChange={() => setAge('minor_with_consent')} />
                <span>Tengo entre 14 y 17 años y cuento con la autorización de mi madre, padre o representante legal.</span>
              </label>
            </fieldset>
          </div>
        )}
        {msg && <p className={msg.kind === 'ok' ? 'form-ok' : 'form-error'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
        <button className="btn primary block" disabled={busy || (mode === 'up' && !canSignUp)}>{busy ? 'Un momento…' : mode === 'in' ? 'Ingresar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}</button>

        <div className="login-or"><span>{mode === 'in' ? '¿Primera vez?' : mode === 'up' ? '¿Ya tienes cuenta?' : '¿Ya la recordaste?'}</span></div>
        <button type="button" className="btn block" onClick={() => go(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Crear mi cuenta' : 'Ingresar'}
        </button>
      </form>
      <nav className="legal-links" aria-label="Legal">
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/terminos">Términos</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contacto</a>
      </nav>
    </main>
  )
}
