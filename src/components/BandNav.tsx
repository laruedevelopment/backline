import { NavLink } from 'react-router-dom'
import { useActiveBand } from '../store/useBandSession'
import { useChatUnread } from '../lib/useLive'
import { useWide } from '../lib/useWide'

/** Banda agrupa a los integrantes, el chat (en pantallas anchas está en el panel lateral) y los ajustes. */
export default function BandNav() {
  const band = useActiveBand()
  const unread = useChatUnread(band?.id)
  const wide = useWide(1240)
  return (
    <div className="music-bar">
      <div className="seg" role="navigation" aria-label="Banda">
        <NavLink to="/banda" end className={({ isActive }) => (isActive ? 'active' : '')}>Integrantes</NavLink>
        {!wide && (
          <NavLink to="/banda/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
            Chat{unread > 0 && <span className="seg-badge" aria-label={`${unread} sin leer`}>{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
        )}
        <NavLink to="/banda/ajustes" className={({ isActive }) => (isActive ? 'active' : '')}>Ajustes</NavLink>
      </div>
    </div>
  )
}
