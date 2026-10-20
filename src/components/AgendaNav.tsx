import { NavLink } from 'react-router-dom'

/** La agenda de la banda y los ensayaderos viven juntos: se reserva una sala para un ensayo. */
export default function AgendaNav() {
  return (
    <div className="seg" role="navigation" aria-label="Agenda">
      <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'active' : '')}>Eventos</NavLink>
      <NavLink to="/ensayaderos" className={({ isActive }) => (isActive ? 'active' : '')}>Ensayaderos</NavLink>
    </div>
  )
}
