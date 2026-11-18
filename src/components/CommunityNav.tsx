import { NavLink } from 'react-router-dom'
import { useSocialBadge } from '../lib/useLive'

/**
 * Encabezado de Comunidad y su submenú: sección → página → submenú, igual que Música, Agenda y Banda.
 * Cada pantalla de Comunidad empieza con esto y luego sus filtros y su contenido.
 */
export default function CommunityNav({ title, sub, onChange }: { title: string; sub?: string; onChange?: () => void }) {
  const pending = useSocialBadge()
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Comunidad</span>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      <div className="seg" role="navigation" aria-label="Comunidad" onClick={onChange}>
        <NavLink to="/explorar/muro" className={cls}>Muro</NavLink>
        <NavLink to="/explorar/mercado" className={cls}>Mercado</NavLink>
        <NavLink to="/explorar" end className={cls}>Bandas</NavLink>
        <NavLink to="/explorar/musicos" className={cls}>Músicos</NavLink>
        <NavLink to="/explorar/buscan" className={cls}>Se busca</NavLink>
        <NavLink to="/explorar/amigos" className={cls}>Amigos{pending > 0 && <span className="seg-badge" aria-label={`${pending} pendientes`}>{pending > 99 ? '99+' : pending}</span>}</NavLink>
      </div>
    </>
  )
}
