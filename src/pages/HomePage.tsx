import { band, events } from '../data/demo'
import EventCard from '../components/EventCard'

export default function HomePage() {
  const next = events[0]
  return (
    <>
      <h1 className="page-title">{band.name}</h1>
      <p className="page-sub">
        {band.genres.join(' · ')} · {band.city} · {band.members.length} integrantes
      </p>

      <div className="hero">
        <div className="section-title" style={{ marginTop: 0 }}>Lo próximo</div>
        <EventCard event={next} bare />
      </div>

      <div className="section-title">Banda</div>
      <div className="stack">
        {band.members.map((m) => (
          <div key={m.name} className="card row">
            <div className="grow">
              <div className="title">{m.name}</div>
              <div className="sub">{m.role}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="sub" style={{ marginTop: 20, whiteSpace: 'normal' }}>
        Datos de demostración. Aquí irá el resumen real de tu banda.
      </p>
    </>
  )
}
