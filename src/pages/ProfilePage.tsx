import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../content/legal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAccount, getProfile, listMembers, purgeBandMedia, updateProfile, type Profile } from '../lib/api'
import { initials, instrumentOptions } from '../lib/identity'
import { lessons } from '../lib/learn'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useBands } from '../store/useBandSession'
import { useProgress } from '../store/useProgress'
import { ask } from '../lib/confirm'
import { PushSettings } from '../components/PushControls'
import ListSkeleton from '../components/Skeleton'

/** Al borrar la cuenta no queda nada de Backline guardado en el dispositivo. */
function clearDeviceData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('backline-')).forEach((k) => localStorage.removeItem(k))
  } catch { /* sin almacenamiento */ }
}

export default function ProfilePage() {
  const session = useAuth((s) => s.session)
  const userId = session?.user.id
  const { data, isLoading } = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(userId!), enabled: !!userId && !!supabase })

  if (!session || !supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Perfil</h1></div>
        <p className="notice">Ingresa con tu cuenta para ver y editar tu perfil.</p>
      </>
    )
  }
  if (isLoading || !data) return <ListSkeleton rows={4} />
  // key: si el perfil cambia desde afuera, el formulario se reinicia con los datos nuevos.
  return <ProfileView key={JSON.stringify(data)} initial={data} userId={session.user.id} email={session.user.email ?? ''} />
}

function ProfileView({ initial, userId, email }: { initial: Profile; userId: string; email: string }) {
  const { bands } = useBands()
  const qc = useQueryClient()
  const done = useProgress((s) => s.done)
  const [name, setName] = useState(initial.displayName)
  const [instruments, setInstruments] = useState<string[]>(initial.instruments)
  const [city, setCity] = useState(initial.city)
  const [bio, setBio] = useState(initial.bio)
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const [danger, setDanger] = useState('')

  const toggle = (i: string) => setInstruments((v) => (v.includes(i) ? v.filter((x) => x !== i) : v.length < 8 ? [...v, i] : v))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setStatus('error')
    setStatus('saving')
    try {
      await updateProfile(userId, { displayName: name, instruments, city, bio })
      await qc.invalidateQueries({ queryKey: ['profile', userId] })
      await qc.invalidateQueries({ queryKey: ['members'] })
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  async function removeAccount() {
    if (!(await ask({ title: '¿Borrar tu cuenta?', body: 'Se eliminan tu perfil, tus respuestas de asistencia y las bandas en las que seas el único integrante. No se puede deshacer.', confirmLabel: 'Borrar mi cuenta', typeToConfirm: 'BORRAR' }))) return
    setDanger('')
    try {
      // Las bandas donde eres el único integrante se borran con la cuenta: se limpian antes sus archivos.
      for (const b of bands.filter((x) => x.role === 'owner')) {
        if ((await listMembers(b.id)).length === 1) await purgeBandMedia(b.id).catch(() => {})
      }
      await deleteAccount()
      clearDeviceData()
      await supabase!.auth.signOut()
    } catch (err) {
      setDanger(/traspasa/i.test(String((err as Error).message))
        ? 'Eres líder de una banda con más integrantes. Traspasa el liderazgo desde Banda antes de borrar tu cuenta.'
        : 'No pudimos borrar la cuenta. Intenta de nuevo.')
    }
  }

  return (
    <>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16 }}>
        <span className="avatar lg" style={{ marginLeft: 0 }} aria-hidden>{initials(name || email || '?')}</span>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Tu perfil</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{name || 'Músico'}</h1>
        </div>
      </div>
      <p className="page-sub">{email}</p>

      {(
        <form className="stack" style={{ marginTop: 16 }} onSubmit={save}>
          <label className="field">Cómo te llaman
            <input value={name} onChange={(e) => { setName(e.target.value); setStatus('') }} maxLength={60} required autoComplete="name" />
          </label>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend className="field" style={{ marginBottom: 6 }}>Lo que tocas (hasta 8)</legend>
            <div className="chips" style={{ marginTop: 0 }}>
              {instrumentOptions.map((i) => (
                <button key={i} type="button" className={`tag ${instruments.includes(i) ? 'key' : ''}`} aria-pressed={instruments.includes(i)}
                  style={{ background: 'none', cursor: 'pointer' }} onClick={() => { toggle(i); setStatus('') }}>{i}</button>
              ))}
            </div>
          </fieldset>
          <label className="field">Ciudad
            <input value={city} onChange={(e) => { setCity(e.target.value); setStatus('') }} maxLength={80} autoComplete="address-level2" />
          </label>
          <label className="field">Sobre ti
            <textarea rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setStatus('') }} maxLength={300} placeholder="Qué tocas, qué escuchas, con quién has tocado. No pongas datos sensibles." />
          </label>
          <button className="btn primary" disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar perfil'}</button>
          {status === 'saved' && <p role="status" className="form-ok">Cambios guardados.</p>}
          {status === 'error' && <p className="form-error" role="alert">No pudimos guardar. Revisa tu nombre e intenta de nuevo.</p>}
        </form>
      )}

      <div className="section-title">Tu práctica</div>
      <div className="stats">
        <div className="stat"><b>{done.length}</b><span>Lecciones hechas</span></div>
        <div className="stat"><b>{lessons.length - done.length}</b><span>Por hacer</span></div>
        <div className="stat"><b>{lessons.filter((l) => done.includes(l.id)).reduce((t, l) => t + l.minutes, 0)}</b><span>Minutos</span></div>
      </div>

      <PushSettings />

      <div className="section-title">Legal y datos</div>
      <div className="list">
        <Link className="li" to="/privacidad"><div className="li-main"><div className="li-title">Política de privacidad</div></div></Link>
        <Link className="li" to="/terminos"><div className="li-main"><div className="li-title">Términos de uso</div></div></Link>
        <a className="li" href={`mailto:${CONTACT_EMAIL}?subject=Backline%3A%20solicitud%20sobre%20mis%20datos`}>
          <div className="li-main"><div className="li-title">Pedir mis datos o hacer un reclamo</div><div className="li-sub">Respondemos consultas en 10 días hábiles y reclamos en 15.</div></div>
        </a>
      </div>

      <div className="section-title">Cuenta</div>
      <div className="stack">
        <button className="btn" onClick={() => void supabase!.auth.signOut()}>Cerrar sesión</button>
        <button className="btn danger" onClick={() => void removeAccount()}>Borrar mi cuenta</button>
        {danger && <p className="form-error" role="alert">{danger}</p>}
        <p className="li-sub wrap">Al borrar tu cuenta se eliminan tu perfil y tus respuestas de asistencia, y también los datos guardados en este dispositivo. Si eres el único integrante de una banda, se borra esa banda.</p>
      </div>
    </>
  )
}
