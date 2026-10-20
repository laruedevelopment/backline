import { NavLink } from 'react-router-dom'

/** Agenda de la banda y salas de ensayo viven juntas: la sala se reserva para un ensayo. */
export default function AgendaNav() {
  return (
    <div className="seg" role="navigation" aria-label="Agenda">
      <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'active' : '')}>Eventos</NavLink>
      <NavLink to="/salas" className={({ isActive }) => (isActive ? 'active' : '')}>Salas de ensayo</NavLink>
    </div>
  )
}
