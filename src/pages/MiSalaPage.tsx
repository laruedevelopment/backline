import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AgendaNav from '../components/AgendaNav'
import ListSkeleton from '../components/Skeleton'
import Sheet from '../components/Sheet'
import ManualBookingSheet from '../components/ManualBookingSheet'
import { PushPrompt } from '../components/PushControls'
import { RoomForm, VenueForm } from '../components/VenueForms'
import VenueMedia from '../components/VenueMedia'
import { ask } from '../lib/confirm'
import { waLink } from '../lib/identity'
import { googleCalendarUrl } from '../lib/calendar'
import { formatDay, formatTime, money, weekOrder, weekdayNames } from '../lib/slots'
import { supabase } from '../lib/supabase'
import {
  bookingError, cancelBooking, createVenue, deleteRoom, deleteVenue, kindLabel, listHours, listRooms, myVenues, purgeVenueMedia,
  respondBooking, saveHours, saveRoom, setAutoConfirm, setPublished, updateVenue, venueBookings, type Booking, type Hours, type Room, type Venue,
} from '../lib/venues'
import { useAuth } from '../store/useAuth'

type Tab = 'requests' | 'rooms' | 'profile'

export default function MiSalaPage() {
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const { data: venues, isLoading } = useQuery({ queryKey: ['my-venues', userId], queryFn: () => myVenues(userId!), enabled: !!userId && !!supabase })

  if (!supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Mi sala</h1></div>
        <p className="notice">Ingresa con tu cuenta para publicar tu sala.</p>
      </>
    )
  }
  if (isLoading) return <ListSkeleton rows={4} />
  const venue = venues?.[0]

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Para dueños de salas</span>
        <h1 className="page-title">Mi sala</h1>
        <p className="page-sub">{venue ? 'Administra tus salitas, tus horarios y las solicitudes de las bandas.' : 'Publica tu sala de ensayo y recibe solicitudes de reserva de las bandas de tu ciudad.'}</p>
      </div>
      <AgendaNav />

      {!venue && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="notice">Es gratis. Cargas tus salitas, tus horarios y tus precios; las bandas piden una franja y tú confirmas o rechazas. El pago se hace en la sala, como siempre.</div>
          <button className="btn primary" onClick={() => setCreating(true)}>Publicar mi sala</button>
          <Link to="/salas" className="link-btn">Ver las salas publicadas</Link>
        </div>
      )}
      {creating && (
        <VenueForm
          onClose={() => setCreating(false)}
          onSave={async (d) => { await createVenue(d); await qc.invalidateQueries({ queryKey: ['my-venues'] }) }}
        />
      )}
      {venue && <Manage venue={venue} />}
    </>
  )
}

function Manage({ venue }: { venue: Venue }) {
  const [tab, setTab] = useState<Tab>('requests')
  const { data: bookings = [] } = useQuery({ queryKey: ['venue-bookings', venue.id], queryFn: () => venueBookings(venue.id) })
  const [now] = useState(() => new Date())
  const pending = bookings.filter((b) => b.status === 'requested' && new Date(b.endsAt) > now).length
  return (
    <>
      <PushPrompt text="Activa los avisos para enterarte al instante cuando una banda pida o cancele una reserva." />
      <div className="seg" role="group" aria-label="Secciones" style={{ marginTop: 18 }}>
        <button aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>Solicitudes{pending ? ` · ${pending}` : ''}</button>
        <button aria-pressed={tab === 'rooms'} onClick={() => setTab('rooms')}>Salitas y horario</button>
        <button aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>Mi perfil</button>
      </div>
      {tab === 'requests' && <Requests bookings={bookings} venue={venue} />}
      {tab === 'rooms' && <RoomsAndHours venue={venue} />}
      {tab === 'profile' && <Profile venue={venue} />}
    </>
  )
}

// ───────── Solicitudes ─────────
function Requests({ bookings, venue }: { bookings: Booking[]; venue: Venue }) {
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  const [manual, setManual] = useState(false)
  const [msg, setMsg] = useState('')
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['venue-bookings', venue.id] }), qc.invalidateQueries({ queryKey: ['busy'] })])

  const respond = useMutation({
    mutationFn: (v: { id: string; status: 'confirmed' | 'rejected'; note: string }) => respondBooking(v.id, v.status, v.note),
    onSuccess: refresh,
    onError: (e) => { setMsg(bookingError(e)); void refresh() },
  })
  const cancel = useMutation({ mutationFn: cancelBooking, onSuccess: refresh, onError: (e) => setMsg(bookingError(e)) })

  const [now] = useState(() => new Date())
  const pending = bookings.filter((b) => b.status === 'requested' && new Date(b.endsAt) > now)
  const confirmed = bookings.filter((b) => b.status === 'confirmed' && new Date(b.endsAt) > now)
  const history = bookings.filter((b) => !pending.includes(b) && !confirmed.includes(b)).reverse().slice(0, 10)

  async function onCancel(b: Booking) {
    if (!(await ask({ title: '¿Cancelar esta reserva?', body: `${b.contactName || 'La banda'} · ${formatDay(new Date(b.startsAt))}. La franja queda libre otra vez.`, confirmLabel: 'Cancelar reserva' }))) return
    setMsg('')
    cancel.mutate(b.id)
  }

  const Row = ({ b, actions }: { b: Booking; actions?: React.ReactNode }) => {
    const s = new Date(b.startsAt), e = new Date(b.endsAt)
    const wa = b.contactPhone ? waLink(b.contactPhone, `Hola ${b.contactName}, te escribo de ${venue.name} sobre tu reserva del ${formatDay(s)}.`) : undefined
    return (
      <div className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="li-main" style={{ minWidth: 200 }}>
          <div className="li-title">{b.contactName || 'Banda sin nombre'} · {b.roomName}</div>
          <div className="li-sub">{formatDay(s)}</div>
          <div className="sub-row"><span>{formatTime(s)} a {formatTime(e)}</span>{b.bandId && <span>A nombre de una banda</span>}{b.source === 'owner' && <span className="tag">Anotada por ti</span>}{wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>WhatsApp</a>}</div>
          {b.note && <div className="li-sub wrap">“{b.note}”</div>}
          {b.responseNote && <div className="li-sub wrap">Tu respuesta: {b.responseNote}</div>}
        </div>
        {actions}
      </div>
    )
  }

  const label = { requested: 'Pendiente', confirmed: 'Confirmada', rejected: 'Rechazada', cancelled: 'Cancelada' } as const

  return (
    <>
      {msg && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{msg}</p>}
      <button className="btn" style={{ marginTop: 16 }} onClick={() => setManual(true)} disabled={rooms.length === 0}>Anotar una reserva (WhatsApp o llamada)</button>
      {rooms.length === 0 && <p className="li-sub wrap" style={{ marginTop: 6 }}>Primero agrega una salita en «Salitas y horario».</p>}
      <div className="section-title">Por responder{pending.length ? ` · ${pending.length}` : ''}</div>
      {pending.length === 0 && <p className="li-sub wrap">No hay solicitudes pendientes. Cuando una banda pida una franja, aparece aquí.</p>}
      <div className="list" style={{ borderTop: pending.length ? undefined : 0 }}>
        {pending.map((b) => (
          <Row key={b.id} b={b} actions={
            <div className="row" style={{ width: '100%', justifyContent: 'flex-end' }}>
              <button className="btn" disabled={respond.isPending} onClick={() => setRejecting(b)}>Rechazar</button>
              <button className="btn primary" disabled={respond.isPending} onClick={() => { setMsg(''); respond.mutate({ id: b.id, status: 'confirmed', note: '' }) }}>Confirmar</button>
            </div>
          } />
        ))}
      </div>

      <div className="section-title">Confirmadas · próximas</div>
      {confirmed.length === 0 && <p className="li-sub wrap">Todavía no hay reservas confirmadas.</p>}
      <div className="list" style={{ borderTop: confirmed.length ? undefined : 0 }}>
        {confirmed.map((b) => (
          <Row key={b.id} b={b} actions={
            <div className="row" style={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <a className="btn" target="_blank" rel="noopener noreferrer" href={googleCalendarUrl({ title: `${b.contactName} · ${b.roomName}`, start: new Date(b.startsAt), end: new Date(b.endsAt), location: `${venue.name}${venue.address ? `, ${venue.address}` : ''}`, details: [b.note, b.contactPhone && `Tel: ${b.contactPhone}`].filter(Boolean).join('\n') })}>Agregar a Google Calendar</a>
              <button className="btn ghost danger" onClick={() => void onCancel(b)} disabled={cancel.isPending}>Cancelar</button>
            </div>
          } />
        ))}
      </div>

      {history.length > 0 && (
        <>
          <div className="section-title">Historial</div>
          <div className="list">
            {history.map((b) => <Row key={b.id} b={b} actions={<span className={`tag ${b.status === 'confirmed' ? 'ok' : ''}`}>{label[b.status]}</span>} />)}
          </div>
        </>
      )}

      {manual && <ManualBookingSheet rooms={rooms} onClose={() => setManual(false)} onSaved={refresh} />}
      {rejecting && <RejectSheet booking={rejecting} onClose={() => setRejecting(null)} onReject={(note) => { setMsg(''); respond.mutate({ id: rejecting.id, status: 'rejected', note }); setRejecting(null) }} />}
    </>
  )
}

function RejectSheet({ booking, onClose, onReject }: { booking: Booking; onClose: () => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Sheet title="Rechazar solicitud" onClose={onClose} onSubmit={(e) => { e.preventDefault(); onReject(note.trim()) }}>
      <p className="li-sub wrap">{booking.contactName} · {booking.roomName} · {formatDay(new Date(booking.startsAt))}</p>
      <label className="field">Motivo (opcional, lo ve quien pidió)
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ese día hay mantenimiento. ¿Te sirve el jueves?" />
      </label>
      <button className="btn danger">Rechazar</button>
    </Sheet>
  )
}

// ───────── Salitas y horario ─────────
function RoomsAndHours({ venue }: { venue: Venue }) {
  const qc = useQueryClient()
  const { data: rooms = [], isLoading } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venue.id], queryFn: () => listHours(venue.id) })
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const refreshRooms = () => qc.invalidateQueries({ queryKey: ['venue-rooms', venue.id] })

  async function removeRoom(r: Room): Promise<boolean> {
    if (!(await ask({ title: `¿Borrar «${r.name}»?`, body: 'Se borran también sus reservas.', confirmLabel: 'Borrar' }))) return false
    await deleteRoom(r.id)
    await refreshRooms()
    return true
  }

  return (
    <>
      <div className="section-title">Salitas</div>
      {isLoading && <ListSkeleton rows={2} />}
      {!isLoading && rooms.length === 0 && <p className="li-sub wrap">Agrega al menos una salita para poder publicarte: cada una se reserva por separado.</p>}
      <div className="list" style={{ borderTop: rooms.length ? undefined : 0 }}>
        {rooms.map((r) => (
          <button key={r.id} className="li" onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`}>
            <div className="li-main">
              <div className="li-title">{r.name}</div>
              <div className="li-sub">Hasta {r.capacity} personas{r.description ? ` · ${r.description}` : ''}</div>
            </div>
            <div className="readout"><b>{money(r.pricePerHour)}</b>{r.pricePerHour ? 'por hora' : ''}</div>
          </button>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>Agregar salita</button>

      <div className="section-title">Horario de atención</div>
      <HoursEditor venueId={venue.id} initial={hours} />

      {editing && (
        <RoomForm
          room={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (r) => { await saveRoom(venue.id, r); await refreshRooms() }}
          onDelete={editing === 'new' ? undefined : () => removeRoom(editing)}
        />
      )}
    </>
  )
}

type Day = { open: boolean; opens: string; closes: string }
const hm = (t: string) => t.slice(0, 5)

function HoursEditor({ venueId, initial }: { venueId: string; initial: Hours[] }) {
  const qc = useQueryClient()
  // key en el padre no reinicia esto; se parte de lo guardado una sola vez.
  const [days, setDays] = useState<Record<number, Day>>(() => {
    const map: Record<number, Day> = {}
    for (let d = 0; d < 7; d++) {
      const h = initial.find((x) => x.weekday === d)
      map[d] = h ? { open: true, opens: hm(h.opens), closes: hm(h.closes) } : { open: false, opens: '16:00', closes: '22:00' }
    }
    return map
  })
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const [error, setError] = useState('')

  const set = (d: number, p: Partial<Day>) => { setDays((v) => ({ ...v, [d]: { ...v[d], ...p } })); setStatus('') }
  const firstOpen = useMemo(() => weekOrder.find((d) => days[d].open), [days])

  function copyToAll() {
    if (firstOpen === undefined) return
    const src = days[firstOpen]
    setDays((v) => Object.fromEntries(Object.entries(v).map(([k, d]) => [k, d.open ? { ...d, opens: src.opens, closes: src.closes } : d])) as Record<number, Day>)
    setStatus('')
  }

  async function save() {
    const rows: Hours[] = []
    for (const d of weekOrder) {
      const x = days[d]
      if (!x.open) continue
      if (x.closes <= x.opens) return setError(`${weekdayNames[d]}: la hora de cierre debe ser después de la de apertura.`)
      rows.push({ weekday: d, opens: x.opens, closes: x.closes })
    }
    setError('')
    setStatus('saving')
    try {
      await saveHours(venueId, rows)
      await qc.invalidateQueries({ queryKey: ['venue-hours', venueId] })
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="stack">
      {weekOrder.map((d) => {
        const x = days[d]
        return (
          <div key={d} className="hours-row">
            <label className="check-row" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={x.open} onChange={(e) => set(d, { open: e.target.checked })} />
              <span>{weekdayNames[d]}</span>
            </label>
            {x.open ? (
              <div className="hours-times">
                <input type="time" value={x.opens} onChange={(e) => set(d, { opens: e.target.value })} aria-label={`${weekdayNames[d]}: abre`} />
                <span aria-hidden>a</span>
                <input type="time" value={x.closes} onChange={(e) => set(d, { closes: e.target.value })} aria-label={`${weekdayNames[d]}: cierra`} />
              </div>
            ) : <span className="li-sub">Cerrado</span>}
          </div>
        )
      })}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={copyToAll} disabled={firstOpen === undefined}>Usar el mismo horario en todos los días abiertos</button>
        <button className="btn primary" onClick={() => void save()} disabled={status === 'saving'}>{status === 'saving' ? 'Guardando…' : 'Guardar horario'}</button>
      </div>
      {status === 'saved' && <p role="status" className="form-ok">Horario guardado.</p>}
      {status === 'error' && <p className="form-error" role="alert">No pudimos guardar el horario. Intenta de nuevo.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

// ───────── Perfil y publicación ─────────
function Profile({ venue }: { venue: Venue }) {
  const qc = useQueryClient()
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', venue.id], queryFn: () => listRooms(venue.id) })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', venue.id], queryFn: () => listHours(venue.id) })
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['my-venues'] }), qc.invalidateQueries({ queryKey: ['venue', venue.id] }), qc.invalidateQueries({ queryKey: ['venues'] })])

  const steps = [
    { label: 'Datos de la sala (nombre, ciudad, contacto)', done: !!venue.name && !!venue.city },
    { label: 'Al menos una salita con su precio', done: rooms.length > 0 },
    { label: 'Horario de atención', done: hours.length > 0 },
  ]
  const ready = steps.every((s) => s.done)

  const publish = useMutation({
    mutationFn: (v: boolean) => setPublished(venue.id, v),
    onSuccess: refresh,
    onError: () => setErr('No pudimos cambiar la publicación. Intenta de nuevo.'),
  })

  const auto = useMutation({
    mutationFn: (on: boolean) => setAutoConfirm(venue.id, on),
    onSuccess: refresh,
    onError: () => setErr('No pudimos cambiar esa opción. Intenta de nuevo.'),
  })

  async function destroy() {
    if (!(await ask({ title: `¿Borrar ${venue.name}?`, body: 'Se borran la sala, sus salitas, horarios, fotos y reservas. No se puede deshacer.', confirmLabel: 'Borrar la sala', typeToConfirm: venue.name }))) return
    try {
      await purgeVenueMedia(venue.id).catch(() => {})
      await deleteVenue(venue.id)
      await refresh()
    } catch { setErr('No pudimos borrar la sala. Intenta de nuevo.') }
  }

  return (
    <>
      <div className="section-title">Publicación</div>
      <div className="checklist">
        {steps.map((s) => (
          <div key={s.label} className={`check ${s.done ? 'done' : ''}`}>
            <span className="box" aria-hidden>{s.done ? '✓' : ''}</span>
            <span className="check-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {venue.isPublished
          ? <button className="btn" disabled={publish.isPending} onClick={() => publish.mutate(false)}>Dejar de publicar (ocultar la sala)</button>
          : <button className="btn primary" disabled={!ready || publish.isPending} onClick={() => publish.mutate(true)}>{ready ? 'Publicar mi sala' : 'Completa los pasos para publicar'}</button>}
        <p className="li-sub wrap">{venue.isPublished ? 'Tu sala es visible para todas las personas con cuenta en Backline.' : 'Mientras no esté publicada, solo tú la ves.'}</p>
        <Link to={`/salas/${venue.id}`} className="link-btn" style={{ justifySelf: 'start' }}>Ver cómo la ven las bandas</Link>
      </div>

      <div className="section-title">Cómo reciben reservas</div>
      <label className="check-row" style={{ alignItems: 'start' }}>
        <input type="checkbox" checked={venue.autoConfirm} disabled={auto.isPending} onChange={(e) => auto.mutate(e.target.checked)} />
        <span>
          <b>Confirmar automáticamente</b><br />
          Si la franja está libre y dentro de tu horario, la reserva queda confirmada al instante y el ensayo aparece solo en la agenda de la banda. Tú no tienes que hacer nada; puedes cancelar cuando quieras.
          {!venue.autoConfirm && ' Ahora cada solicitud espera tu respuesta.'}
        </span>
      </label>

      <div className="section-title">Datos</div>
      <div className="kv">
        <span>Tipo</span><span className="readout">{kindLabel[venue.kind]}</span>
        <span>Nombre</span><span className="readout">{venue.name}</span>
        <span>Ciudad</span><span className="readout">{venue.city || '—'}</span>
        <span>WhatsApp</span><span className="readout">{venue.whatsapp || '—'}</span>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Editar datos</button>

      <VenueMedia venue={venue} canEdit />

      <div className="section-title">Zona delicada</div>
      <button className="btn danger" onClick={() => void destroy()}>Borrar mi sala</button>
      {err && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{err}</p>}

      {editing && <VenueForm venue={venue} onClose={() => setEditing(false)} onSave={async (d) => { await updateVenue(venue.id, d); await refresh() }} />}
    </>
  )
}
