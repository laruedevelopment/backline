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
 * Barra superior. Eres una sola persona con dos modos: Músico (que pertenece a varias bandas) y Negocio (por ejemplo una sala de ensayos).
 * El selector «Músico | Negocio» cambia de modo; las bandas son algo del modo Músico: la pastilla de banda cambia de banda activa.
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
  const me = profile?.displayName || (session?.user.user_metadata?.name as string | undefined) || session?.user.email || 'Tú'
  const close = () => { setOpen(false); setAdding(false) }

  return (
    <header className="topbar">
      {venue && (
        <div className="seg modeseg" role="group" aria-label="Modo">
          <button type="button" className={!inBusiness ? 'active' : ''} aria-pressed={!inBusiness} onClick={() => { if (inBusiness) nav('/') }}>Músico</button>
          <button type="button" className={inBusiness ? 'active' : ''} aria-pressed={inBusiness} onClick={() => { if (!inBusiness) nav('/mi-negocio') }}>
            Negocio{!inBusiness && pending > 0 && <span className="seg-badge" aria-label={`${pending} solicitudes de reserva por responder en tu negocio`}>{pending}</span>}
          </button>
        </div>
      )}

      {inBusiness ? (
        <Link to="/mi-negocio/perfil" className="bandbtn" aria-label={`Tu negocio: ${venue!.name}`}>
          <BandMark name={venue!.name} logoUrl={venue!.logoUrl} />
          <span className="who">
            <span className="ctx">{kindLabel[venue!.kind]}</span>
            <span className="name">{venue!.name}</span>
          </span>
        </Link>
      ) : (
        <button className="bandbtn" onClick={() => setOpen(true)} disabled={!band} aria-haspopup="dialog" aria-label={`Banda activa: ${band?.name ?? demoBand.name}. Cambiar de banda`}>
          <BandMark name={band?.name ?? demoBand.name} logoUrl={band?.logoUrl} />
          <span className="who">
            <span className="ctx">Banda</span>
            <span className="name">{band?.name ?? demoBand.name}</span>
          </span>
          {band && <ChevronDown size={16} className="chev" aria-hidden />}
        </button>
      )}
      {session && <Link to="/perfil" className="avatar-link" aria-label="Mi perfil"><Avatar name={me} url={profile?.avatarUrl} /></Link>}

      {open && (
        <Sheet title="Mis bandas" onClose={close} dismissOnBackdrop>
          {!adding ? (
            <>
              <div className="list">
                {bands.map((b) => (
                  <button key={b.id} className="li" onClick={() => { setActive(b.id); close() }} aria-pressed={b.id === band?.id}>
                    <BandMark name={b.name} logoUrl={b.logoUrl} />
                    <span className="li-main">
                      <span className="li-title" style={{ display: 'block' }}>{b.name}</span>
                      <span className="li-sub" style={{ display: 'block' }}>{b.city || 'Sin ciudad'}</span>
                    </span>
                    {b.id === band?.id && <Check size={20} color="var(--amber)" aria-label="Activa" />}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setAdding(true)}>Crear otra banda o unirme con código</button>
              {!venue && (
                <>
                  <div className="section-title" style={{ margin: '14px 0 0' }}>¿Tienes un negocio?</div>
                  <p className="li-sub wrap">Si tienes una sala de ensayos u otro negocio musical, publícalo en Backline y recibe reservas de las bandas.</p>
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
