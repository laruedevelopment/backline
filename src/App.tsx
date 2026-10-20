import { useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarDays, GraduationCap, Home, Music2, Users } from 'lucide-react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { myBands } from './lib/api'
import { supabase } from './lib/supabase'
import { useAuth } from './store/useAuth'
import { BandContext, BandsContext } from './store/useBandSession'
import TopBar from './components/TopBar'
import { ConfirmHost } from './components/Confirm'
import OnboardingPage from './pages/OnboardingPage'
import LoginPage from './pages/LoginPage'
import NewPasswordPage from './pages/NewPasswordPage'
import HomePage from './pages/HomePage'
import RepertoirePage from './pages/RepertoirePage'
import SetlistsPage from './pages/SetlistsPage'
import SetlistDetailPage from './pages/SetlistDetailPage'
import AgendaPage from './pages/AgendaPage'
import LearnPage from './pages/LearnPage'
import LessonPage from './pages/LessonPage'
import BandPage from './pages/BandPage'
import ProfilePage from './pages/ProfilePage'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, match: (p: string) => p === '/' },
  { to: '/repertorio', label: 'Música', icon: Music2, match: (p: string) => p.startsWith('/repertorio') || p.startsWith('/setlists') },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, match: (p: string) => p.startsWith('/agenda') },
  { to: '/aprender', label: 'Aprender', icon: GraduationCap, match: (p: string) => p.startsWith('/aprender') },
  { to: '/banda', label: 'Banda', icon: Users, match: (p: string) => p.startsWith('/banda') },
]

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

const ACTIVE_KEY = 'backline-active-band'
const readActive = () => { try { return localStorage.getItem(ACTIVE_KEY) } catch { return null } }

function WithBand() {
  const userId = useAuth((s) => s.session?.user.id)
  const { data: bands, isLoading, error, refetch } = useQuery({ queryKey: ['bands', userId], queryFn: () => myBands(userId!), enabled: !!userId })
  const [activeId, setActiveId] = useState<string | null>(readActive)
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
        <OnboardingPage />
      )}
    </BandsContext.Provider>
  )
}

export default function App() {
  const { session, ready, recovery } = useAuth()
  if (!ready) return <Splash />
  if (recovery && session) return <NewPasswordPage />
  if (supabase && !session) return <LoginPage />
  return (
    <QueryClientProvider client={queryClient}>
      {supabase ? <WithBand /> : <Shell />}
      <ConfirmHost />
    </QueryClientProvider>
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
  return (
    <nav className="nav" aria-label="Principal">
      <div className="wordmark">back<span>line</span></div>
      {tabs.map(({ to, label, icon: Icon, match }) => (
        <NavLink key={to} to={to} className={match(pathname) ? 'active' : ''} aria-current={match(pathname) ? 'page' : undefined}>
          <Icon size={22} strokeWidth={1.7} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function Shell() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className="shell">
        <Nav />
        <div className="main">
          <TopBar />
          <main className="content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/repertorio" element={<RepertoirePage />} />
              <Route path="/setlists" element={<SetlistsPage />} />
              <Route path="/setlists/:id" element={<SetlistDetailPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/aprender" element={<LearnPage />} />
              <Route path="/aprender/:id" element={<LessonPage />} />
              <Route path="/banda" element={<BandPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
