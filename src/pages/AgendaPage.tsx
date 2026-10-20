import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { listMembers, type BandEvent, type RsvpStatus } from '../lib/api'
import { useAuth } from '../store/useAuth'
import { useActiveBand } from '../store/useBandSession'
import { useSetlists } from '../lib/useSetlists'
import { dayParts, isUpcoming, useEvents } from '../lib/useEvents'
import AgendaNav from '../components/AgendaNav'
import EventForm from '../components/EventForm'
import ListSkeleton from '../components/Skeleton'

const options: { v: RsvpStatus; label: string }[] = [
  { v: 'yes', label: 'Voy' },
  { v: 'maybe', label: 'Tal vez' },
  { v: 'no', label: 'No voy' },
]
const kindLabel = { rehearsal: 'Ensayo', gig: 'Toque', other: 'Evento' } as const

export default function AgendaPage() {
  const band = useActiveBand()
  if (!band) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Agenda</h1></div>
        <p className="notice">Ingresa con tu cuenta para ver y crear los ensayos y toques de tu banda.</p>
      </>
    )
  }
  return <CloudAgenda bandId={band.id} canEdit={band.role !== 'guest'} />
}

function CloudAgenda({ bandId, canEdit }: { bandId: string; canEdit: boolean }) {
  const userId = useAuth((s) => s.session?.user.id)
  const { events, loading, error, save, remove, rsvp } = useEvents(bandId, userId)
  const { setlists } = useSetlists(bandId)
  const { data: members = [] } = useQuery({ queryKey: ['members', bandId], queryFn: () => listMembers(bandId) })
  const [editing, setEditing] = useState<BandEvent | 'new' | null>(null)
  const [showPast, setShowPast] = useState(false)

  const upcoming = events.filter(isUpcoming)
  const past = events.filter((e) => !isUpcoming(e)).reverse()
  const shown = showPast ? past : upcoming

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Ensayos y toques</span>
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">Confirma si vas para que nadie tenga que preguntar en el chat.</p>
      </div>
      <AgendaNav />
      <div className="seg" role="group" aria-label="Rango" style={{ marginTop: 12 }}>
        <button aria-pressed={!showPast} onClick={() => setShowPast(false)}>Próximos{upcoming.length ? ` · ${upcoming.length}` : ''}</button>
        <button aria-pressed={showPast} onClick={() => setShowPast(true)}>Pasados</button>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {loading && <ListSkeleton rows={3} />}
      {!loading && shown.length === 0 && (
        <div className="empty">
          <h3>{showPast ? 'Sin eventos pasados' : 'Nada agendado'}</h3>
          <p>{showPast ? 'Cuando pasen los ensayos y toques, quedan aquí.' : canEdit ? 'Crea el próximo ensayo o toque y la banda podrá confirmar asistencia desde el celular.' : 'El líder aún no ha agendado nada.'}</p>
          {!showPast && canEdit && <button className="btn primary" onClick={() => setEditing('new')}>Agendar un evento</button>}
        </div>
      )}

      <div className="stack" style={{ marginTop: 18 }}>
        {shown.map((e) => {
          const { day, month, long, time } = dayParts(e.startsAt)
          const mine = e.rsvps.find((r) => r.profileId === userId)?.status
          const yes = e.rsvps.filter((r) => r.status === 'yes').length
          const pending = members.filter((m) => !e.rsvps.some((r) => r.profileId === m.profileId)).map((m) => m.name)
          const setlist = setlists.find((s) => s.id === e.setlistId)
          return (
            <article key={e.id}>
              <div className={`ticket ${showPast ? 'past' : ''}`}>
                <div className="ticket-date"><b>{day}</b><span>{month}</span></div>
                <div className="ticket-body">
                  <span className="eyebrow">{kindLabel[e.kind]} · {long}</span>
                  <div className="ticket-title">{e.title}</div>
                  <div className="li-sub">{time}{e.place ? ` · ${e.place}` : ''}</div>
                  <div className="sub-row">
                    <span style={{ color: 'var(--sage)' }}>{yes}/{members.length || 1} confirmados</span>
                    {setlist && <Link to={`/setlists/${setlist.id}`} style={{ color: 'var(--amber)' }}>{setlist.name}</Link>}
                    {canEdit && <button className="link-btn" style={{ minHeight: 28, padding: 0, fontSize: '0.8rem' }} onClick={() => setEditing(e)}>Editar</button>}
                  </div>
                </div>
              </div>
              {e.notes && <p className="li-sub wrap" style={{ marginTop: 8 }}>{e.notes}</p>}
              {!showPast && (
                <div className="rsvp" role="group" aria-label={`¿Vas a ${e.title}?`}>
                  {options.map((o) => (
                    <button key={o.v} className={`btn ${mine === o.v ? `on ${o.v}` : ''}`} aria-pressed={mine === o.v} onClick={() => rsvp(e.id, o.v)}>{o.label}</button>
                  ))}
                </div>
              )}
              {!showPast && pending.length > 0 && <p className="li-sub wrap" style={{ marginTop: 8 }}>Sin responder: {pending.join(', ')}</p>}
            </article>
          )
        })}
      </div>

      {canEdit && shown.length > 0 && !showPast && (
        <button className="btn primary fab" onClick={() => setEditing('new')}><Plus size={20} aria-hidden /> Nuevo evento</button>
      )}
      {editing && (
        <EventForm
          event={editing === 'new' ? undefined : editing}
          setlists={setlists}
          onSave={save}
          onDelete={editing === 'new' ? undefined : () => remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
