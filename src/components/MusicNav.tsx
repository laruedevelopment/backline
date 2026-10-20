import { NavLink } from 'react-router-dom'

/** Música agrupa canciones y setlists. */
export default function MusicNav() {
  return (
    <div className="seg" role="navigation" aria-label="Música">
      <NavLink to="/repertorio" className={({ isActive }) => (isActive ? 'active' : '')}>Canciones</NavLink>
      <NavLink to="/setlists" className={({ isActive }) => (isActive ? 'active' : '')}>Setlists</NavLink>
    </div>
  )
}
