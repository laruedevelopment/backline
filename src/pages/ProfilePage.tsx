import { useState } from 'react'
import { Copy, LogOut, UserPlus } from 'lucide-react'
import { createInvite } from '../lib/api'
import { useActiveBand, useBands } from '../store/useBandSession'
import OnboardingPage from './OnboardingPage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'

export default function ProfilePage() {
  const session = useAuth((s) => s.session)
  const band = useActiveBand()
  const { bands, setActive } = useBands()
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const canInvite = band?.role === 'owner' || band?.role === 'admin'
  async function invite() {
    setErr('')
    try { setCode(await createInvite(band!.id, session!.user.id)) } catch { setErr('No pudimos crear el código. Intenta de nuevo.') }
  }
  const name = session?.user.user_metadata?.name as string | undefined
  return (
    <>
      <h1 className="page-title">Perfil</h1>
      <p className="page-sub">Tu rig, tus bandas y tu música</p>
      {session && (
        <div className="card row" style={{ marginBottom: 12 }}>
          <div className="grow">
            <div className="title">{name || 'Músico'}</div>
            <div className="sub">{session.user.email}</div>
          </div>
          <button className="btn" onClick={() => void supabase?.auth.signOut()}>
            <LogOut size={18} aria-hidden /> Salir
          </button>
        </div>
      )}
      {bands.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 8 }}>Tus bandas</div>
          <div className="stack" style={{ marginBottom: 12 }}>
            {bands.map((b) => (
              <button key={b.id} className={`card row pick ${b.id === band?.id ? 'current' : ''}`} onClick={() => setActive(b.id)} aria-pressed={b.id === band?.id}>
                <div className="grow">
                  <div className="title">{b.name}</div>
                  <div className="sub">{b.city || 'Sin ciudad'}</div>
                </div>
                {b.id === band?.id && <span className="chip ok">Activa</span>}
              </button>
            ))}
          </div>
          {adding ? <OnboardingPage onCancel={() => setAdding(false)} /> : (
            <button className="btn" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>Crear otra banda o unirme a una</button>
          )}
        </>
      )}
      {band && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="title">{band.name}</div>
          <div className="sub">{band.city || 'Sin ciudad'} · {band.role === 'owner' ? 'Líder' : band.role === 'admin' ? 'Admin' : 'Miembro'}</div>
          {canInvite && (
            <>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => void invite()}>
                <UserPlus size={18} aria-hidden /> Invitar a un integrante
              </button>
              {code && (
                <div className="row" style={{ marginTop: 10 }}>
                  <code className="invite-code grow">{code}</code>
                  <button className="btn" aria-label="Copiar código" onClick={() => void navigator.clipboard.writeText(code)}><Copy size={18} aria-hidden /></button>
                </div>
              )}
              {code && <div className="sub note">Pásaselo por WhatsApp. Sirve 7 días: en la app elige "Tengo un código".</div>}
              {err && <p className="form-error" role="alert">{err}</p>}
            </>
          )}
        </div>
      )}
      <div className="card empty">
        Aquí vas a mostrar tus instrumentos, tu pedalboard y tus videos.
        <br />
        Llega en la Fase 2.
      </div>
    </>
  )
}
