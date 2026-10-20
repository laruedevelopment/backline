import { useQuery } from '@tanstack/react-query'
import Avatar from '../components/Avatar'
import { Link } from 'react-router-dom'
import { band as demoBand } from '../data/demo'
import { listMembers } from '../lib/api'
import { lessons } from '../lib/learn'
import { useAuth } from '../store/useAuth'
import { useActiveBand } from '../store/useBandSession'
import { useProgress } from '../store/useProgress'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { dayParts, isUpcoming, useEvents } from '../lib/useEvents'
import ListSkeleton from '../components/Skeleton'
import { usePendingRequests } from '../lib/useLive'

const roleLabel: Record<string, string> = { owner: 'Líder', admin: 'Admin', member: 'Integrante', guest: 'Invitado' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function inDays(iso: string) {
  const start = new Date(iso)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const d = Math.round((start.getTime() - today.getTime()) / 86_400_000)
  return d <= 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`
}

export default function HomePage() {
  const band = useActiveBand()
  const session = useAuth((s) => s.session)
  const userId = session?.user.id
  const first = ((session?.user.user_metadata?.name as string | undefined) ?? '').split(' ')[0]
  const { songs, loading } = useSongs(band?.id)
  const { setlists } = useSetlists(band?.id)
  const { events: bandEvents, rsvp } = useEvents(band?.id, userId)
  const { data: members = [] } = useQuery({ queryKey: ['members', band?.id], queryFn: () => listMembers(band!.id), enabled: !!band })
  const done = useProgress((s) => s.done)
  const { count: pendingRequests, venue: myVenue } = usePendingRequests()

  const title = band?.name ?? demoBand.name
  const next = bandEvents.find(isUpcoming)
  const parts = next && dayParts(next.startsAt)
  const setlist = next && setlists.find((s) => s.id === next.setlistId)
  const going = next?.rsvps.filter((r) => r.status === 'yes').length ?? 0
  const mine = next?.rsvps.find((r) => r.profileId === userId)?.status
  const ready = songs.filter((s) => s.status === 'ready').length
  const nextLesson = lessons.find((l) => !done.includes(l.id))
  const canEdit = band ? band.role !== 'guest' : true
  const steps = [
    { label: 'Agrega tus primeras 3 canciones', to: '/repertorio', done: songs.length >= 3 },
    { label: 'Arma un setlist (o impórtalo del chat)', to: '/setlists', done: setlists.length > 0 },
    { label: 'Invita a alguien de la banda', to: '/banda', done: members.length > 1 },
    { label: 'Agenda el próximo ensayo', to: '/agenda', done: bandEvents.length > 0 },
  ]

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{greeting()}{first ? `, ${first}` : ''}</span>
        <h1 className="page-title">{title}</h1>
        {band && <p className="page-sub">{[band.city, band.genres.join(' · ')].filter(Boolean).join(' · ')}</p>}
      </div>

      <div className="home-grid">
      <div className="home-col">
      {pendingRequests > 0 && (
        <Link to="/mi-negocio" className="notice" style={{ display: 'block', marginTop: 8 }}>
          <b>{pendingRequests === 1 ? 'Tienes 1 solicitud de reserva' : `Tienes ${pendingRequests} solicitudes de reserva`}</b> por responder en {myVenue?.name ?? 'tu sala de ensayos'}.
        </Link>
      )}

      <div className="section-title" style={{ marginTop: 8 }}>Lo próximo</div>
      {next && parts ? (
        <article>
          <div className="ticket">
            <div className="ticket-date"><b>{parts.day}</b><span>{parts.month}</span></div>
            <div className="ticket-body">
              <span className="eyebrow">{inDays(next.startsAt)} · {next.kind === 'gig' ? 'Toque' : next.kind === 'rehearsal' ? 'Ensayo' : 'Evento'}</span>
              <Link to="/agenda" className="ticket-title">{next.title}</Link>
              <div className="li-sub">{parts.time}{next.place ? ` · ${next.place}` : ''}</div>
              <div className="sub-row">
                <span>{going}/{members.length || 1} confirmados</span>
                {setlist && <Link to={`/setlists/${setlist.id}`} style={{ color: 'var(--amber)' }}>{setlist.name}</Link>}
              </div>
            </div>
          </div>
          <div className="rsvp compact" role="group" aria-label={`¿Vas a ${next.title}?`}>
            {([['yes', 'Voy'], ['maybe', 'Tal vez'], ['no', 'No voy']] as const).map(([v, label]) => (
              <button key={v} className={`btn ${mine === v ? `on ${v}` : ''}`} aria-pressed={mine === v} onClick={() => rsvp(next.id, v)}>{label}</button>
            ))}
          </div>
          {!mine && <p className="li-sub" style={{ marginTop: 6, color: 'var(--amber)' }}>Falta tu respuesta.</p>}
        </article>
      ) : (
        <div className="notice">
          Nada agendado todavía. {canEdit ? <Link to="/agenda" style={{ color: 'var(--amber)', fontWeight: 600 }}>Agenda el próximo ensayo</Link> : 'El líder aún no ha agendado nada.'}
        </div>
      )}

      {canEdit && !loading && steps.some((st) => !st.done) && (
        <>
          <div className="section-title">Primeros pasos · {steps.filter((st) => st.done).length}/{steps.length}</div>
          <div className="checklist">
            {steps.map((st) => (
              <Link key={st.label} to={st.to} className={`check ${st.done ? 'done' : ''}`}>
                <span className="box" aria-hidden>{st.done ? '✓' : ''}</span>
                <span className="check-label">{st.label}</span>
                <span className="sr-only">{st.done ? 'Hecho' : 'Pendiente'}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      </div>
      <div className="home-col">
      <div className="section-title" style={{ marginTop: 8 }}>Repertorio</div>
      {loading ? <ListSkeleton rows={1} /> : songs.length === 0 ? (
        <div className="empty" style={{ padding: '4px 0' }}>
          <p>Todavía no hay canciones. Aquí verás cuántas tiene lista la banda.</p>
          <Link className="link-btn" to="/repertorio">Ir al repertorio</Link>
        </div>
      ) : (
        <Link to="/repertorio" className="stats" aria-label="Ver repertorio">
          <div className="stat"><b>{songs.length}</b><span>Canciones</span></div>
          <div className="stat"><b>{ready}</b><span>Listas</span></div>
          <div className="stat"><b>{songs.length - ready}</b><span>Por pulir</span></div>
        </Link>
      )}

      {nextLesson && (
        <>
          <div className="section-title">Para practicar</div>
          <Link to={`/aprender/${nextLesson.id}`} className="li" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="li-main">
              <div className="li-title">{nextLesson.title}</div>
              <div className="li-sub">{nextLesson.minutes} min · {nextLesson.bpm.start} → {nextLesson.bpm.goal} bpm</div>
            </div>
            <span className="tag">Empezar</span>
          </Link>
        </>
      )}

      <div className="section-title">La banda</div>
      <div className="avatars">
        {members.map((m) => (
          <div key={m.profileId} className="person">
            <Avatar name={m.name} url={m.avatarUrl} size={48} />
            <b>{m.name.split(' ')[0]}</b>
            <span>{m.instrument ?? m.instruments[0] ?? roleLabel[m.role]}</span>
          </div>
        ))}
        {members.length === 0 && band === undefined && <p className="sub">Modo demostración.</p>}
      </div>
      <p className="sub" style={{ marginTop: 12 }}>
        <Link to="/banda" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ver y administrar la banda</Link>
      </p>
      </div>
      <div className="section-title">¿Tienes una sala de ensayos?</div>
      <p className="notice">Publica tus salas, horarios y precios y recibe reservas. <Link to="/mi-negocio" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ir a mi negocio</Link></p>
      </div>
    </>
  )
}
