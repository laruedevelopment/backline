import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarClock, CalendarDays, Compass, DoorOpen, GraduationCap, Home, Music2, Store, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { persistOptions, queryClient } from './lib/queryClient'
import { joinBand, myBands } from './lib/api'
import { supabase } from './lib/supabase'
import { useAuth } from './store/useAuth'
import { BandContext, BandsContext } from './store/useBandSession'
import TopBar from './components/TopBar'
import OfflineBanner from './components/OfflineBanner'
import { useLiveBookings, usePendingRequests } from './lib/useLive'
import { ConfirmHost } from './components/Confirm'
import OnboardingPage from './pages/OnboardingPage'
import JoinPage from './pages/JoinPage'

/** Pantallas de formulario o de lectura: no se estiran a todo el ancho de un monitor. */
function Measure({ children }: { children: React.ReactNode }) { return <div className="measure">{children}</div> }
import { clearPendingInvite, readPendingInvite } from './lib/pendingInvite'
import LegalPage from './pages/LegalPage'
import LoginPage from './pages/LoginPage'
import NewPasswordPage from './pages/NewPasswordPage'
import HomePage from './pages/HomePage'
import RepertoirePage from './pages/RepertoirePage'
import SetlistsPage from './pages/SetlistsPage'
import SetlistDetailPage from './pages/SetlistDetailPage'
import AgendaPage from './pages/AgendaPage'
import EnsayaderosPage from './pages/EnsayaderosPage'
import EnsayaderoPage from './pages/EnsayaderoPage'
import BusinessLayout from './pages/business/BusinessLayout'
import ExplorePage from './pages/ExplorePage'
import PublicBandPage from './pages/PublicBandPage'
import PublicMusicianPage from './pages/PublicMusicianPage'
import LearnPage from './pages/LearnPage'
import LessonPage from './pages/LessonPage'
import BandPage from './pages/BandPage'
import ProfilePage from './pages/ProfilePage'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, match: (p: string) => p === '/' },
  { to: '/repertorio', label: 'Música', icon: Music2, match: (p: string) => p.startsWith('/repertorio') || p.startsWith('/setlists') },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, match: (p: string) => p.startsWith('/agenda') || p.startsWith('/ensayaderos') },
  { to: '/aprender', label: 'Aprender', icon: GraduationCap, match: (p: string) => p.startsWith('/aprender') },
  { to: '/explorar', label: 'Comunidad', icon: Compass, match: (p: string) => p.startsWith('/explorar') },
  { to: '/banda', label: 'Banda', icon: Users, match: (p: string) => p.startsWith('/banda') },
]

/** El otro sombrero: cuando el usuario administra su negocio (ensayadero), la navegación cambia. */
const businessTabs = [
  { to: '/mi-negocio', label: 'Hoy', icon: CalendarClock, match: (p: string) => p === '/mi-negocio' },
  { to: '/mi-negocio/reservas', label: 'Reservas', icon: CalendarDays, match: (p: string) => p.startsWith('/mi-negocio/reservas') },
  { to: '/mi-negocio/salas', label: 'Salas', icon: DoorOpen, match: (p: string) => p.startsWith('/mi-negocio/salas') },
  { to: '/mi-negocio/perfil', label: 'Ensayadero', icon: Store, match: (p: string) => p.startsWith('/mi-negocio/perfil') },
  { to: '/', label: 'Mis bandas', icon: Users, match: () => false },
]

const ACTIVE_KEY = 'backline-active-band'
const readActive = () => { try { return localStorage.getItem(ACTIVE_KEY) } catch { return null } }

function WithBand() {
  const userId = useAuth((s) => s.session?.user.id)
  const { data: bands, isLoading, error, refetch } = useQuery({ queryKey: ['bands', userId], queryFn: () => myBands(userId!), enabled: !!userId })
  const [activeId, setActiveId] = useState<string | null>(readActive)
  const qc = useQueryClient()
  const [inviteMsg, setInviteMsg] = useState('')
  const joining = useRef(false)

  // Invitación por link: quien llegó con un código (aunque haya tenido que crear la cuenta antes) entra solo a esa banda.
  useEffect(() => {
    const code = readPendingInvite()
    if (!code || !userId || joining.current) return
    joining.current = true
    joinBand(code)
      .then(async (id) => {
        clearPendingInvite()
        await qc.refetchQueries({ queryKey: ['bands', userId] })
        setActiveId(id)
        try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* solo en memoria */ }
      })
      .catch(() => {
        clearPendingInvite()
        setInviteMsg('Ese link de invitación ya no sirve o venció. Pídele a tu banda uno nuevo.')
      })
  }, [userId, qc])
  const setActive = (id: string) => {
    setActiveId(id)
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* sin almacenamiento: queda solo en memoria */ }
  }
  if (isLoading) return <Splash />
  if (error) {
    return (
      <div className="fullscreen-msg" role="alert">
        <div className="brand-big">back<span>line</span></div>
        <p className="page-sub">No pudimos cargar tu banda. Revisa tu conexión.</p>
        <button className="btn primary" onClick={() => void refetch()}>Reintentar</button>
        <button className="link-btn" onClick={() => void supabase?.auth.signOut()}>Cerrar sesión</button>
      </div>
    )
  }
  const list = bands ?? []
  const active = list.find((b) => b.id === activeId) ?? list[0]
  return (
    <BandsContext.Provider value={{ bands: list, setActive }}>
      {active ? (
        <BandContext.Provider value={active}>
          <Shell />
        </BandContext.Provider>
      ) : (
        <>
          {inviteMsg && <p className="form-error" role="alert" style={{ margin: 16, textAlign: 'center' }}>{inviteMsg}</p>}
          <OnboardingPage />
        </>
      )}
    </BandsContext.Provider>
  )
}

function AuthGate() {
  const { session, ready, recovery } = useAuth()
  if (!ready) return <Splash />
  if (recovery && session) return <NewPasswordPage />
  if (supabase && !session) return <LoginPage />
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {supabase ? <WithBand /> : <Shell />}
      <ConfirmHost />
    </PersistQueryClientProvider>
  )
}

function Splash() {
  return (
    <div className="fullscreen-msg" aria-busy="true" aria-label="Cargando">
      <div className="brand-big">back<span>line</span></div>
      <div className="skeleton" style={{ width: 140, height: 4 }} />
    </div>
  )
}

function Nav() {
  const { pathname } = useLocation()
  const { count: pending } = usePendingRequests()
  const inBusiness = pathname.startsWith('/mi-negocio')
  return (
    <nav className="nav" aria-label={inBusiness ? 'Mi negocio' : 'Principal'}>
      <div className="wordmark">back<span>line</span></div>
      {(inBusiness ? businessTabs : tabs).map(({ to, label, icon: Icon, match }) => (
        <NavLink key={to} to={to} className={match(pathname) ? 'active' : ''} aria-current={match(pathname) ? 'page' : undefined}>
          <span className="icon-wrap">
            <Icon size={22} strokeWidth={1.7} aria-hidden />
            {inBusiness && to === '/mi-negocio' && pending > 0 && <span className="badge" aria-label={`${pending} solicitudes de reserva por responder`}>{pending}</span>}
          </span>
          {label}
        </NavLink>
      ))}
      <div className="nav-foot">
        <NavLink to="/perfil">Mi perfil</NavLink>
        <NavLink to="/privacidad">Privacidad</NavLink>
        <NavLink to="/terminos">Términos</NavLink>
      </div>
    </nav>
  )
}

function Shell() {
  useLiveBookings()
  return (
    <div className="shell">
        <Nav />
        <div className="main">
          <TopBar />
          <OfflineBanner />
          <main className="content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/repertorio" element={<RepertoirePage />} />
              <Route path="/setlists" element={<SetlistsPage />} />
              <Route path="/setlists/:id" element={<SetlistDetailPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/ensayaderos" element={<EnsayaderosPage />} />
              <Route path="/ensayaderos/:id" element={<Measure><EnsayaderoPage /></Measure>} />
              <Route path="/mi-negocio/*" element={<BusinessLayout />} />
              <Route path="/explorar" element={<ExplorePage />} />
              <Route path="/explorar/musicos" element={<ExplorePage />} />
              <Route path="/explorar/bandas/:id" element={<Measure><PublicBandPage /></Measure>} />
              <Route path="/explorar/musicos/:id" element={<Measure><PublicMusicianPage /></Measure>} />
              <Route path="/aprender" element={<LearnPage />} />
              <Route path="/aprender/:id" element={<Measure><LessonPage /></Measure>} />
              <Route path="/banda" element={<Measure><BandPage /></Measure>} />
              <Route path="/perfil" element={<Measure><ProfilePage /></Measure>} />
            </Routes>
          </main>
        </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        {/* Públicas: se pueden leer antes de registrarse. */}
        <Route path="/privacidad" element={<LegalPage doc="privacy" />} />
        <Route path="/terminos" element={<LegalPage doc="terms" />} />
        <Route path="/unirse/:code" element={<JoinPage />} />
        <Route path="*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  )
}
