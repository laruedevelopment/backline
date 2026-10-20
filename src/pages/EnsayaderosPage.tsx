import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import AgendaNav from '../components/AgendaNav'
import { PushPrompt } from '../components/PushControls'
import BandMark from '../components/BandMark'
import ListSkeleton from '../components/Skeleton'
import { ask } from '../lib/confirm'
import { norm } from '../lib/importSetlist'
import { supabase } from '../lib/supabase'
import { googleCalendarUrl } from '../lib/calendar'
import { formatDay, formatTime, money } from '../lib/slots'
import { bookingError, cancelBooking, kindLabel, listVenues, minPrices, myBookings, myVenues, type Booking } from '../lib/venues'
import { useAuth } from '../store/useAuth'

const statusText = { requested: 'Pendiente', confirmed: 'Confirmada', rejected: 'Rechazada', cancelled: 'Cancelada' } as const

export default function EnsayaderosPage() {
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [now] = useState(() => new Date()) // una sola lectura por visita: evita cálculos distintos en cada render

  const venuesQ = useQuery({ queryKey: ['venues'], queryFn: listVenues, enabled: !!supabase })
  const venues = venuesQ.data
  const { data: prices = {} } = useQuery({ queryKey: ['venue-prices', venues?.map((v) => v.id).join(',')], queryFn: () => minPrices(venues!.map((v) => v.id)), enabled: !!venues?.length })
  const { data: bookings = [] } = useQuery({ queryKey: ['my-bookings'], queryFn: myBookings, enabled: !!supabase })
  const { data: mine = [] } = useQuery({ queryKey: ['my-venues', userId], queryFn: () => myVenues(userId!), enabled: !!userId })

  const cancel = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-bookings'] }),
    onError: (e) => setMsg(bookingError(e)),
  })

  const shown = useMemo(() => {
    const needle = norm(q)
    return (venues ?? []).filter((v) => !needle || norm(`${v.name} ${v.city} ${v.address}`).includes(needle))
  }, [venues, q])

  const upcoming = bookings.filter((b) => (b.status === 'requested' || b.status === 'confirmed') && new Date(b.endsAt) > now).reverse()

  async function onCancel(b: Booking) {
    if (!(await ask({ title: '¿Cancelar la reserva?', body: `${b.venueName} · ${formatDay(new Date(b.startsAt))}`, confirmLabel: 'Cancelar reserva' }))) return
    setMsg('')
    cancel.mutate(b.id)
  }

  if (!supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Ensayaderos</h1></div>
        <p className="notice">Ingresa con tu cuenta para ver los ensayaderos y reservar.</p>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Ensayos</span>
        <h1 className="page-title">Ensayaderos</h1>
        <p className="page-sub">Encuentra un ensayadero, mira sus salas y horarios y pide tu franja. Si reservas a nombre de tu banda, el ensayo aparece solo en la agenda.</p>
      </div>
      <AgendaNav />
      {upcoming.length > 0 && <PushPrompt text="Activa los avisos para saber al instante cuando el ensayadero responda tu solicitud." />}

      {upcoming.length > 0 && (
        <>
          <div className="section-title">Mis reservas</div>
          <div className="list">
            {upcoming.slice(0, 6).map((b) => {
              const s = new Date(b.startsAt), e = new Date(b.endsAt)
              return (
                <div key={b.id} className="li" style={{ alignItems: 'flex-start' }}>
                  <div className="li-main">
                    <Link to={`/ensayaderos/${b.venueId}`} className="li-title" style={{ display: 'block' }}>{b.venueName} · {b.roomName}</Link>
                    <div className="li-sub">{formatDay(s)}</div>
                    <div className="sub-row"><span>{formatTime(s)} a {formatTime(e)}</span><span className={`tag ${b.status === 'confirmed' ? 'ok' : ''}`}>{statusText[b.status]}</span></div>
                  </div>
                  <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {b.status === 'confirmed' && <a className="btn ghost" target="_blank" rel="noopener noreferrer" href={googleCalendarUrl({ title: `Ensayo en ${b.venueName} · ${b.roomName}`, start: s, end: e, location: b.venueName })}>Google Calendar</a>}
                    <button className="btn ghost danger" onClick={() => void onCancel(b)} disabled={cancel.isPending}>Cancelar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      {msg && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{msg}</p>}

      <div className="section-title">Ensayaderos</div>
      <label className="search">
        <Search size={18} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o ciudad" aria-label="Buscar ensayaderos" />
      </label>

      {venuesQ.isLoading && <ListSkeleton rows={3} />}
      {venuesQ.error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>No pudimos cargar los ensayaderos. Revisa tu conexión.</p>}
      {!venuesQ.isLoading && !venuesQ.error && (venues?.length ?? 0) === 0 && (
        <div className="empty">
          <h3>Aún no hay ensayaderos publicados</h3>
          <p>Los ensayaderos que se publiquen en Backline aparecen aquí con sus salas, horarios y precios. ¿Tienes o conoces uno? Pídele que lo publique.</p>
        </div>
      )}
      {(venues?.length ?? 0) > 0 && shown.length === 0 && <p className="empty">Ningún ensayadero coincide con esa búsqueda.</p>}

      <div className="list cols" style={{ marginTop: 14, borderTop: shown.length ? undefined : 0 }}>
        {shown.map((v) => (
          <Link key={v.id} to={`/ensayaderos/${v.id}`} className="li" style={{ minHeight: 76 }}>
            <BandMark name={v.name} logoUrl={v.logoUrl} />
            <div className="li-main">
              <div className="li-title">{v.name}</div>
              <div className="li-sub">{[kindLabel[v.kind], v.city].filter(Boolean).join(' · ')}</div>
              {v.amenities.length > 0 && <div className="li-sub">{v.amenities.slice(0, 3).join(' · ')}</div>}
            </div>
            <div className="readout">{prices[v.id] ? <><span className="eyebrow">desde</span><b>{money(prices[v.id])}</b>por hora</> : <><b>—</b>consultar</>}</div>
          </Link>
        ))}
      </div>

      <div className="section-title">¿Tienes un ensayadero?</div>
      <div className="notice">
        {mine.length > 0
          ? <>Administra tus salas, tus horarios y las reservas. <Link to="/mi-negocio" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ir a mi negocio</Link></>
          : <>Publica tu ensayadero en Backline: tus salas, horarios y precios, y recibe reservas de las bandas. <Link to="/mi-negocio" style={{ color: 'var(--amber)', fontWeight: 600 }}>Publicar mi ensayadero</Link></>}
      </div>
    </>
  )
}
