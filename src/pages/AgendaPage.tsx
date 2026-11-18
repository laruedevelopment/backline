import { useState } from 'react'
import { listGear } from '../lib/gear'
import PageHead from '../components/PageHead'
import { supabase } from '../lib/supabase'
import EventGear from '../components/EventGear'
import Sheet from '../components/Sheet'
import { saveRecap } from '../lib/api'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  const [gearFor, setGearFor] = useState<BandEvent | null>(null)
  const [recapFor, setRecapFor] = useState<BandEvent | null>(null)
  const [recapText, setRecapText] = useState('')
  const [recapError, setRecapError] = useState('')
  const qcAgenda = useQueryClient()
  const { data: gear = [] } = useQuery({ queryKey: ['gear', bandId], queryFn: () => listGear(bandId!), enabled: !!supabase && !!bandId })

  const upcoming = events.filter(isUpcoming)
  const past = events.filter((e) => !isUpcoming(e)).reverse()
  const shown = showPast ? past : upcoming

  return (
    <>
      <PageHead eyebrow="Agenda" title="Eventos" info="Confirma si vas para que nadie tenga que preguntar en el chat." />
      <AgendaNav />
      <div className="filter-chips" role="group" aria-label="Rango" style={{ marginTop: 14 }}>
        <button className={!showPast ? 'active' : ''} aria-pressed={!showPast} onClick={() => setShowPast(false)}>Próximos{upcoming.length ? ` · ${upcoming.length}` : ''}</button>
        <button className={showPast ? 'active' : ''} aria-pressed={showPast} onClick={() => setShowPast(true)}>Pasados</button>
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
              {showPast && e.recap && <p className="recap"><b>Resumen:</b> {e.recap}</p>}
              {supabase && showPast && canEdit && (
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { setRecapFor(e); setRecapText(e.recap ?? ''); setRecapError('') }}>{e.recap ? 'Editar resumen' : 'Escribir resumen'}</button>
              )}
              {supabase && !showPast && (
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setGearFor(e)}>
                  Equipo{(() => { const g = gear.filter((x) => x.eventId === e.id); return g.length ? ` · ${g.filter((x) => x.done).length}/${g.length}` : '' })()}
                </button>
              )}
              {!showPast && pending.length > 0 && <p className="li-sub wrap" style={{ marginTop: 8 }}>Sin responder: {pending.join(', ')}</p>}
            </article>
          )
        })}
      </div>

      {canEdit && shown.length > 0 && !showPast && (
        <button className="btn primary fab" onClick={() => setEditing('new')}><Plus size={20} aria-hidden /> Nuevo evento</button>
      )}
      {recapFor && (
        <Sheet title={`Resumen · ${recapFor.title}`} onClose={() => setRecapFor(null)} onSubmit={async (ev) => {
          ev.preventDefault()
          try { await saveRecap(recapFor.id, recapText); await qcAgenda.invalidateQueries({ queryKey: ['events', bandId] }); setRecapFor(null) } catch { setRecapError('No se pudo guardar. Intenta de nuevo.') }
        }}>
          <p className="li-sub wrap">Qué salió bien, qué hay que mejorar y qué dejar listo para la próxima. Lo lee toda la banda.</p>
          <label className="field">Resumen
            <textarea rows={7} value={recapText} maxLength={2000} placeholder={'Salió bien: el cierre.\nMejorar: entrada del coro en la 4.\nPara la próxima: llevar extensión.'} onChange={(e) => setRecapText(e.target.value)} />
          </label>
          {recapError && <p className="form-error" role="alert">{recapError}</p>}
          <div className="sheet-foot"><div className="row"><button type="button" className="btn" onClick={() => setRecapFor(null)}>Cancelar</button><button className="btn primary grow">Guardar</button></div></div>
        </Sheet>
      )}
      {gearFor && bandId && <EventGear bandId={bandId} eventId={gearFor.id} title={gearFor.title} canEdit={canEdit} onClose={() => setGearFor(null)} />}
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
