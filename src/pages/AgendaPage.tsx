import { events } from '../data/demo'
import EventCard from '../components/EventCard'

export default function AgendaPage() {
  return (
    <>
      <h1 className="page-title">Agenda</h1>
      <p className="page-sub">Ensayos y toques de la banda</p>
      <div className="stack">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </>
  )
}
