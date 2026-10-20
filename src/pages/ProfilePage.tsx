import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAccount, getProfile, updateProfile, type Profile } from '../lib/api'
import { initials, instrumentOptions } from '../lib/identity'
import { lessons } from '../lib/learn'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useProgress } from '../store/useProgress'
import ListSkeleton from '../components/Skeleton'

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
    if (!confirm('Vas a borrar tu cuenta y tus datos personales. Esto no se puede deshacer.\n¿Continuar?')) return
    setDanger('')
    try {
      await deleteAccount()
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
                  style={{ minHeight: 36, background: 'none', cursor: 'pointer' }} onClick={() => { toggle(i); setStatus('') }}>{i}</button>
              ))}
            </div>
          </fieldset>
          <label className="field">Ciudad
            <input value={city} onChange={(e) => { setCity(e.target.value); setStatus('') }} maxLength={80} autoComplete="address-level2" />
          </label>
          <label className="field">Sobre ti
            <textarea rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setStatus('') }} maxLength={300} placeholder="Qué tocas, qué escuchas, con quién has tocado." />
          </label>
          <button className="btn primary" disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar perfil'}</button>
          {status === 'saved' && <p role="status" style={{ color: 'var(--sage)' }}>Cambios guardados.</p>}
          {status === 'error' && <p className="form-error" role="alert">No pudimos guardar. Revisa tu nombre e intenta de nuevo.</p>}
        </form>
      )}

      <div className="section-title">Tu práctica</div>
      <div className="stats">
        <div className="stat"><b>{done.length}</b><span>Lecciones hechas</span></div>
        <div className="stat"><b>{lessons.length - done.length}</b><span>Por hacer</span></div>
        <div className="stat"><b>{lessons.filter((l) => done.includes(l.id)).reduce((t, l) => t + l.minutes, 0)}</b><span>Minutos</span></div>
      </div>

      <div className="section-title">Cuenta</div>
      <div className="stack">
        <button className="btn" onClick={() => void supabase!.auth.signOut()}>Cerrar sesión</button>
        <button className="btn danger" onClick={() => void removeAccount()}>Borrar mi cuenta</button>
        {danger && <p className="form-error" role="alert">{danger}</p>}
        <p className="li-sub wrap">Al borrar tu cuenta se eliminan tu perfil y tus respuestas de asistencia. Si eres el único integrante de una banda, también se borra esa banda.</p>
      </div>
    </>
  )
}
