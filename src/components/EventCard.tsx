import type { EventItem } from '../data/demo'

export default function EventCard({ event, bare }: { event: EventItem; bare?: boolean }) {
  const [, day, month] = event.date.split(' ')
  const gig = event.kind === 'gig'
  return (
    <div className={bare ? 'row' : 'card row'}>
      <div className="date-badge">
        <b>{day}</b>
        {month}
      </div>
      <div className="grow">
        <div className="title">{event.title}</div>
        <div className="sub">
          {event.time} · {event.place}
        </div>
        <div className="chips">
          <span className={`chip ${gig ? 'warn' : ''}`}>{gig ? 'Toque' : 'Ensayo'}</span>
          <span className="chip">
            {event.going}/{event.total} confirmados
          </span>
        </div>
      </div>
    </div>
  )
}
