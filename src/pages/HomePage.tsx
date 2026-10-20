import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { band as demoBand } from '../data/demo'
import { listMembers } from '../lib/api'
import { initials } from '../lib/identity'
import { lessons } from '../lib/learn'
import { useAuth } from '../store/useAuth'
import { useActiveBand } from '../store/useBandSession'
import { useProgress } from '../store/useProgress'
import { useSongs } from '../lib/useSongs'
import { useSetlists } from '../lib/useSetlists'
import { dayParts, isUpcoming, useEvents } from '../lib/useEvents'
import ListSkeleton from '../components/Skeleton'

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
  const { events: bandEvents } = useEvents(band?.id, userId)
  const { data: members = [] } = useQuery({ queryKey: ['members', band?.id], queryFn: () => listMembers(band!.id), enabled: !!band })
  const done = useProgress((s) => s.done)

  const title = band?.name ?? demoBand.name
  const next = bandEvents.find(isUpcoming)
  const parts = next && dayParts(next.startsAt)
  const setlist = next && setlists.find((s) => s.id === next.setlistId)
  const going = next?.rsvps.filter((r) => r.status === 'yes').length ?? 0
  const mine = next?.rsvps.find((r) => r.profileId === userId)?.status
  const ready = songs.filter((s) => s.status === 'ready').length
  const nextLesson = lessons.find((l) => !done.includes(l.id))
  const canEdit = band ? band.role !== 'guest' : true

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{greeting()}{first ? `, ${first}` : ''}</span>
        <h1 className="page-title">{title}</h1>
        {band && <p className="page-sub">{[band.city, band.genres.join(' · ')].filter(Boolean).join(' · ')}</p>}
      </div>

      <div className="section-title" style={{ marginTop: 8 }}>Lo próximo</div>
      {next && parts ? (
        <Link to="/agenda" className="ticket" aria-label={`${next.title}, ${parts.long}`}>
          <div className="ticket-date"><b>{parts.day}</b><span>{parts.month}</span></div>
          <div className="ticket-body">
            <span className="eyebrow">{inDays(next.startsAt)} · {next.kind === 'gig' ? 'Toque' : next.kind === 'rehearsal' ? 'Ensayo' : 'Evento'}</span>
            <div className="ticket-title">{next.title}</div>
            <div className="li-sub">{parts.time}{next.place ? ` · ${next.place}` : ''}</div>
            <div className="sub-row">
              <span>{going}/{members.length || 1} confirmados</span>
              {mine ? <span style={{ color: mine === 'yes' ? 'var(--sage)' : mine === 'no' ? 'var(--ember)' : 'var(--amber)' }}>Tú: {mine === 'yes' ? 'vas' : mine === 'no' ? 'no vas' : 'tal vez'}</span> : <span style={{ color: 'var(--amber)' }}>Falta tu respuesta</span>}
              {setlist && <span>{setlist.name}</span>}
            </div>
          </div>
        </Link>
      ) : (
        <div className="notice">
          Nada agendado todavía. {canEdit ? <Link to="/agenda" style={{ color: 'var(--amber)', fontWeight: 600 }}>Agenda el próximo ensayo</Link> : 'El líder aún no ha agendado nada.'}
        </div>
      )}

      {canEdit && (
        <>
          <div className="section-title">Acciones rápidas</div>
          <div className="quick">
            <Link className="btn" to="/repertorio">Agregar canción</Link>
            <Link className="btn" to="/setlists">Importar setlist</Link>
            <Link className="btn" to="/agenda">Nuevo evento</Link>
            <Link className="btn" to="/banda">Invitar a la banda</Link>
          </div>
        </>
      )}

      <div className="section-title">Repertorio</div>
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
      <div className="list">
        {members.map((m) => (
          <div key={m.profileId} className="li" style={{ minHeight: 56 }}>
            <span className="avatar" style={{ marginLeft: 0 }}>{initials(m.name)}</span>
            <div className="li-main">
              <div className="li-title">{m.name}</div>
              <div className="li-sub">{[m.instrument ?? m.instruments[0], roleLabel[m.role]].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ))}
        {members.length === 0 && band === undefined && <p className="sub" style={{ padding: 12 }}>Modo demostración.</p>}
      </div>
      <p className="sub" style={{ marginTop: 12 }}>
        <Link to="/banda" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ver y administrar la banda</Link>
      </p>
    </>
  )
}
