import { NavLink } from 'react-router-dom'

/** Música agrupa canciones y setlists. Las acciones (agregar, importar) van discretas al lado, no encima del contenido. */
export default function MusicNav({ children }: { children?: React.ReactNode }) {
  return (
    <div className="music-bar">
      <div className="seg" role="navigation" aria-label="Música">
        <NavLink to="/repertorio" className={({ isActive }) => (isActive ? 'active' : '')}>Canciones</NavLink>
        <NavLink to="/setlists" className={({ isActive }) => (isActive ? 'active' : '')}>Setlists</NavLink>
      </div>
      {children && <div className="music-actions">{children}</div>}
    </div>
  )
}
