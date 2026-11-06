import { NavLink } from 'react-router-dom'
import { useActiveBand } from '../store/useBandSession'
import { useChatUnread } from '../lib/useLive'

/** Banda agrupa a los integrantes y el chat. El contador muestra los mensajes sin leer. */
export default function BandNav() {
  const band = useActiveBand()
  const unread = useChatUnread(band?.id)
  return (
    <div className="music-bar">
      <div className="seg" role="navigation" aria-label="Banda">
        <NavLink to="/banda" end className={({ isActive }) => (isActive ? 'active' : '')}>Integrantes</NavLink>
        <NavLink to="/banda/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
          Chat{unread > 0 && <span className="seg-badge" aria-label={`${unread} sin leer`}>{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
      </div>
    </div>
  )
}
