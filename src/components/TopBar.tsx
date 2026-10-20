import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, X } from 'lucide-react'
import { band as demoBand } from '../data/demo'
import { getProfile } from '../lib/api'
import { initials } from '../lib/identity'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { useActiveBand, useBands } from '../store/useBandSession'
import OnboardingPage from '../pages/OnboardingPage'

/** Barra superior: selector de banda (varias por músico) y acceso al perfil. */
export default function TopBar() {
  const band = useActiveBand()
  const { bands, setActive } = useBands()
  const session = useAuth((s) => s.session)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const userId = session?.user.id
  const { data: profile } = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(userId!), enabled: !!userId && !!supabase })
  const name = band?.name ?? demoBand.name
  const me = profile?.displayName || (session?.user.user_metadata?.name as string | undefined) || session?.user.email || 'Tú'

  return (
    <header className="topbar">
      <button className="bandbtn" onClick={() => setOpen(true)} disabled={!band} aria-haspopup="dialog" aria-label={`Banda activa: ${name}. Cambiar de banda`}>
        <span className="mono-mark">{initials(name)}</span>
        <span className="name">{name}</span>
        {band && <ChevronDown size={16} className="chev" aria-hidden />}
      </button>
      {session && (
        <Link to="/perfil" className="avatar" aria-label="Mi perfil">{initials(me)}</Link>
      )}

      {open && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Tus bandas" onClick={(e) => e.target === e.currentTarget && (setOpen(false), setAdding(false))}>
          <div className="sheet">
            <div className="row">
              <h2 className="grow">Tus bandas</h2>
              <button className="btn ghost" onClick={() => { setOpen(false); setAdding(false) }} aria-label="Cerrar"><X size={20} aria-hidden /></button>
            </div>
            {!adding ? (
              <>
                <div className="list">
                  {bands.map((b) => (
                    <button key={b.id} className="li" onClick={() => { setActive(b.id); setOpen(false) }} aria-pressed={b.id === band?.id}>
                      <span className="mono-mark">{initials(b.name)}</span>
                      <span className="li-main">
                        <span className="li-title" style={{ display: 'block' }}>{b.name}</span>
                        <span className="li-sub" style={{ display: 'block' }}>{b.city || 'Sin ciudad'}</span>
                      </span>
                      {b.id === band?.id && <Check size={20} color="var(--amber)" aria-label="Activa" />}
                    </button>
                  ))}
                </div>
                <button className="btn" onClick={() => setAdding(true)}>Crear otra banda o unirme con código</button>
              </>
            ) : (
              <OnboardingPage onCancel={() => { setAdding(false); setOpen(false) }} />
            )}
          </div>
        </div>
      )}
    </header>
  )
}
