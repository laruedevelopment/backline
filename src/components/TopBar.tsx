import { useState } from 'react'
import Avatar from './Avatar'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown } from 'lucide-react'
import { band as demoBand } from '../data/demo'
import { getProfile } from '../lib/api'
import { supabase } from '../lib/supabase'
import { usePendingRequests } from '../lib/useLive'
import { kindLabel } from '../lib/venues'
import { useAuth } from '../store/useAuth'
import { useActiveBand, useBands } from '../store/useBandSession'
import OnboardingPage from '../pages/OnboardingPage'
import BandMark from './BandMark'
import Sheet from './Sheet'

/**
 * Barra superior. El usuario puede tener dos sombreros: sus bandas y su negocio (por ejemplo una sala de ensayos).
 * El selector de aquí cambia entre ellos; cada uno tiene su propia navegación.
 */
export default function TopBar() {
  const band = useActiveBand()
  const { bands, setActive } = useBands()
  const session = useAuth((s) => s.session)
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const { count: pending, venue } = usePendingRequests()
  const userId = session?.user.id
  const { data: profile } = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(userId!), enabled: !!userId && !!supabase })

  const inBusiness = pathname.startsWith('/mi-negocio') && !!venue
  const name = inBusiness ? venue!.name : band?.name ?? demoBand.name
  const logo = inBusiness ? venue!.logoUrl : band?.logoUrl
  const me = profile?.displayName || (session?.user.user_metadata?.name as string | undefined) || session?.user.email || 'Tú'
  const close = () => { setOpen(false); setAdding(false) }

  return (
    <header className="topbar">
      <button className="bandbtn" onClick={() => setOpen(true)} disabled={!band} aria-haspopup="dialog" aria-label={`${inBusiness ? 'Negocio' : 'Banda'} activo: ${name}. Cambiar`}>
        <span className="icon-wrap">
          <BandMark name={name} logoUrl={logo} />
          {!inBusiness && pending > 0 && <span className="badge" aria-label={`${pending} solicitudes de reserva por responder en tu negocio`}>{pending}</span>}
        </span>
        <span className="who">
          {inBusiness && <span className="ctx">{kindLabel[venue!.kind]}</span>}
          <span className="name">{name}</span>
        </span>
        {band && <ChevronDown size={16} className="chev" aria-hidden />}
      </button>
      {session && <Link to="/perfil" className="avatar-link" aria-label="Mi perfil"><Avatar name={me} url={profile?.avatarUrl} /></Link>}

      {open && (
        <Sheet title="Cambiar de sombrero" onClose={close} dismissOnBackdrop>
          {!adding ? (
            <>
              <div className="section-title" style={{ margin: '4px 0 0' }}>Mis bandas</div>
              <div className="list">
                {bands.map((b) => (
                  <button key={b.id} className="li" onClick={() => { setActive(b.id); close(); if (inBusiness) nav('/') }} aria-pressed={!inBusiness && b.id === band?.id}>
                    <BandMark name={b.name} logoUrl={b.logoUrl} />
                    <span className="li-main">
                      <span className="li-title" style={{ display: 'block' }}>{b.name}</span>
                      <span className="li-sub" style={{ display: 'block' }}>{b.city || 'Sin ciudad'}</span>
                    </span>
                    {!inBusiness && b.id === band?.id && <Check size={20} color="var(--amber)" aria-label="Activa" />}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setAdding(true)}>Crear otra banda o unirme con código</button>

              <div className="section-title" style={{ margin: '14px 0 0' }}>Mi negocio</div>
              {venue ? (
                <div className="list">
                  <button className="li" onClick={() => { close(); nav('/mi-negocio') }} aria-pressed={inBusiness}>
                    <BandMark name={venue.name} logoUrl={venue.logoUrl} />
                    <span className="li-main">
                      <span className="li-title" style={{ display: 'block' }}>{venue.name}</span>
                      <span className="li-sub" style={{ display: 'block' }}>{kindLabel[venue.kind]}{venue.city ? ` · ${venue.city}` : ''}</span>
                    </span>
                    {pending > 0 && <span className="tag key">{pending} por responder</span>}
                    {inBusiness && <Check size={20} color="var(--amber)" aria-label="Activo" />}
                  </button>
                </div>
              ) : (
                <>
                  <p className="li-sub wrap">¿Tienes una sala de ensayos u otro negocio musical? Publícalo en Backline y recibe reservas de las bandas.</p>
                  <button className="btn" onClick={() => { close(); nav('/mi-negocio') }}>Publicar mi sala de ensayos</button>
                </>
              )}
            </>
          ) : (
            <OnboardingPage onCancel={close} />
          )}
        </Sheet>
      )}
    </header>
  )
}
