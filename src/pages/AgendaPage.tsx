import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListMusic, MapPin, Pencil, Plus } from 'lucide-react'
import { events as demoEvents } from '../data/demo'
import { listMembers, type BandEvent, type RsvpStatus } from '../lib/api'
import { useAuth } from '../store/useAuth'
import { useActiveBand } from '../store/useBandSession'
import { useSetlists } from '../lib/useSetlists'
import { dayParts, isUpcoming, useEvents } from '../lib/useEvents'
import EventCard from '../components/EventCard'
import EventForm from '../components/EventForm'

const options: { v: RsvpStatus; label: string }[] = [
  { v: 'yes', label: 'Voy' },
  { v: 'maybe', label: 'Tal vez' },
  { v: 'no', label: 'No voy' },
]

export default function AgendaPage() {
  const band = useActiveBand()
  if (!band) {
    return (
      <>
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">Ensayos y toques de la banda (demostración)</p>
        <div className="stack">{demoEvents.map((e) => <EventCard key={e.id} event={e} />)}</div>
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
      <h1 className="page-title">Agenda</h1>
      <p className="page-sub">Ensayos y toques. Confirma si vas para que nadie tenga que preguntar en el chat.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={!showPast} className={!showPast ? 'active' : ''} onClick={() => setShowPast(false)}>Próximos</button>
        <button role="tab" aria-selected={showPast} className={showPast ? 'active' : ''} onClick={() => setShowPast(true)}>Pasados</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="empty">Cargando…</p>}
      {!loading && shown.length === 0 && (
        <p className="empty">{showPast ? 'Todavía no hay eventos pasados.' : canEdit ? 'No hay nada agendado. Crea el próximo ensayo.' : 'No hay nada agendado.'}</p>
      )}
      <div className="stack" style={{ marginTop: 12 }}>
        {shown.map((e) => {
          const { day, month, long, time } = dayParts(e.startsAt)
          const mine = e.rsvps.find((r) => r.profileId === userId)?.status
          const yes = e.rsvps.filter((r) => r.status === 'yes').length
          const pending = members.filter((m) => !e.rsvps.some((r) => r.profileId === m.profileId)).map((m) => m.name)
          const setlist = setlists.find((s) => s.id === e.setlistId)
          return (
            <div key={e.id} className="card">
              <div className="row">
                <div className="date-badge"><b>{day}</b>{month}</div>
                <div className="grow">
                  <div className="title">{e.title}</div>
                  <div className="sub" style={{ textTransform: 'capitalize' }}>{long} · {time}</div>
                  {e.place && <div className="sub"><MapPin size={12} aria-hidden /> {e.place}</div>}
                </div>
                {canEdit && (
                  <button className="btn" aria-label={`Editar ${e.title}`} onClick={() => setEditing(e)}><Pencil size={18} aria-hidden /></button>
                )}
              </div>
              <div className="chips">
                <span className={`chip ${e.kind === 'gig' ? 'warn' : ''}`}>{e.kind === 'gig' ? 'Toque' : e.kind === 'rehearsal' ? 'Ensayo' : 'Evento'}</span>
                <span className="chip ok">{yes}/{members.length || 1} confirmados</span>
                {setlist && <Link className="chip" to={`/setlists/${setlist.id}`}><ListMusic size={12} aria-hidden /> {setlist.name}</Link>}
              </div>
              {e.notes && <div className="sub note">{e.notes}</div>}
              <div className="rsvp" role="group" aria-label="¿Vas?">
                {options.map((o) => (
                  <button key={o.v} className={`btn ${mine === o.v ? `on ${o.v}` : ''}`} aria-pressed={mine === o.v} onClick={() => rsvp(e.id, o.v)}>{o.label}</button>
                ))}
              </div>
              {pending.length > 0 && <div className="sub note">Sin responder: {pending.join(', ')}</div>}
            </div>
          )
        })}
      </div>
      {canEdit && (
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
