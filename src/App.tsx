import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarDays, Home, ListMusic, Music2, User } from 'lucide-react'
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
  { to: '/perfil', label: 'Perfil', icon: User },
]

export default function App() {
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
            <Route path="/perfil" element={<ProfilePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
