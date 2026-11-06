import { NavLink } from 'react-router-dom'
import { useSocialBadge } from '../lib/useLive'

/** Comunidad: bandas, músicos y amigos (con contador de mensajes y solicitudes pendientes). */
export default function CommunityNav({ onChange }: { onChange?: () => void }) {
  const pending = useSocialBadge()
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')
  return (
    <div className="seg" role="navigation" aria-label="Comunidad" onClick={onChange}>
      <NavLink to="/explorar" end className={cls}>Bandas</NavLink>
      <NavLink to="/explorar/musicos" className={cls}>Músicos</NavLink>
      <NavLink to="/explorar/buscan" className={cls}>Se busca</NavLink>
      <NavLink to="/explorar/amigos" className={cls}>Amigos{pending > 0 && <span className="seg-badge" aria-label={`${pending} pendientes`}>{pending > 99 ? '99+' : pending}</span>}</NavLink>
    </div>
  )
}
