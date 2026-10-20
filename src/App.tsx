import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarDays, GraduationCap, Home, ListMusic, Music2, User } from 'lucide-react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { myBands } from './lib/api'
import { BandContext } from './store/useBandSession'
import OnboardingPage from './pages/OnboardingPage'
import LoginPage from './pages/LoginPage'
import { supabase } from './lib/supabase'
import { useAuth } from './store/useAuth'
import LearnPage from './pages/LearnPage'
import LessonPage from './pages/LessonPage'
import HomePage from './pages/HomePage'
import RepertoirePage from './pages/RepertoirePage'
import SetlistsPage from './pages/SetlistsPage'
import AgendaPage from './pages/AgendaPage'
import ProfilePage from './pages/ProfilePage'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/repertorio', label: 'Repertorio', icon: Music2 },
  { to: '/setlists', label: 'Setlists', icon: ListMusic },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/aprender', label: 'Aprender', icon: GraduationCap },
  { to: '/perfil', label: 'Perfil', icon: User },
]

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

function WithBand() {
  const { data: bands, isLoading, error } = useQuery({ queryKey: ['bands'], queryFn: myBands })
  if (isLoading) return <p className="empty">Cargando tu banda…</p>
  if (error) return <p className="empty">No pudimos cargar tu banda. Revisa tu conexión y recarga.</p>
  if (!bands?.length) return <OnboardingPage />
  return (
    <BandContext.Provider value={bands[0]}>
      <Shell />
    </BandContext.Provider>
  )
}

export default function App() {
  const { session, ready } = useAuth()
  if (!ready) return <p className="empty">Cargando…</p>
  if (!supabase) return <Shell />
  if (!session) return <LoginPage />
  return (
    <QueryClientProvider client={queryClient}>
      <WithBand />
    </QueryClientProvider>
  )
}

function Shell() {
  return (
    <BrowserRouter>
      <div className="shell">
        <nav className="nav" aria-label="Principal">
          <div className="brand">
            back<span>line</span>
          </div>
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={22} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/repertorio" element={<RepertoirePage />} />
            <Route path="/setlists" element={<SetlistsPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/aprender" element={<LearnPage />} />
            <Route path="/aprender/:id" element={<LessonPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
