import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead'
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
import PayPanel from '../components/PayPanel'
import { bookingError, cancelBooking, payExpired, kindLabel, listVenues, minPrices, myBookings, myVenues, type Booking } from '../lib/venues'
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

  // Devoluciones: las pendientes siempre; las ya resueltas solo durante 30 días.
  const refunds = bookings.filter((b) => b.status === 'cancelled' && (b.payStatus === 'refund_due' || ((b.payStatus === 'refunded' || b.payStatus === 'no_refund') && new Date(b.startsAt).getTime() > now.getTime() - 30 * 86_400_000)))
  const upcoming = bookings.filter((b) => (b.status === 'requested' || b.status === 'confirmed') && new Date(b.endsAt) > now).reverse()

  async function onCancel(b: Booking) {
    if (!(await ask({ title: '¿Cancelar la reserva?', body: `${b.venueName} · ${formatDay(new Date(b.startsAt))}`, confirmLabel: 'Cancelar reserva' }))) return
    setMsg('')
    cancel.mutate(b.id)
  }

  if (!supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Salas de ensayos</h1></div>
        <p className="notice">Ingresa con tu cuenta para ver las salas de ensayos y reservar.</p>
      </>
    )
  }

  return (
    <>
      <PageHead eyebrow="Agenda" title="Salas de ensayos" info="Encuentra una sala de ensayos, mira sus salas y horarios y pide tu franja. Si reservas a nombre de tu banda, el ensayo aparece solo en la agenda." />
      <AgendaNav />
      {upcoming.length > 0 && <PushPrompt text="Activa los avisos para saber al instante cuando la sala de ensayos responda tu solicitud." />}

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
                    <div className="sub-row"><span>{formatTime(s)} a {formatTime(e)}</span><span className={`tag ${b.status === 'confirmed' ? 'ok' : ''}`}>{statusText[b.status]}</span>{b.payStatus === 'awaiting' && <span className="tag key">Falta el pago</span>}{b.payStatus === 'proof_sent' && <span className="tag">Comprobante enviado</span>}{b.payStatus === 'paid' && <span className="tag ok">Pagada</span>}</div>
                    {b.status === 'confirmed' && b.payStatus !== 'not_required' && !payExpired(b) && <PayPanel b={b} />}
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
      {refunds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="section-title">Devoluciones</div>
          <div className="list">
            {refunds.slice(0, 5).map((b) => (
              <div key={b.id} className="li" style={{ alignItems: 'flex-start' }}>
                <div className="li-main">
                  <Link to={`/ensayaderos/${b.venueId}`} className="li-title" style={{ display: 'block' }}>{b.venueName} · {b.roomName}</Link>
                  <div className="li-sub">{formatDay(new Date(b.startsAt))} · cancelada</div>
                  <div className="li-sub wrap">
                    {b.payStatus === 'refund_due' && 'Pagaste esta reserva. La sala debe devolverte el dinero según su política; si no lo hace, escríbele desde Backline.'}
                    {b.payStatus === 'refunded' && `La sala marcó el dinero como devuelto.${b.payNote ? ` Nota: ${b.payNote}` : ''}`}
                    {b.payStatus === 'no_refund' && `La sala indicó que no aplica devolución según su política.${b.payNote ? ` Nota: ${b.payNote}` : ''}`}
                  </div>
                  {b.payStatus === 'refund_due' && <Link className="btn sm" style={{ marginTop: 6 }} to={`/explorar/amigos/${b.venueOwnerId}`}>Escribir a la sala</Link>}
                </div>
                <span className={`tag ${b.payStatus === 'refund_due' ? 'key' : ''}`}>{b.payStatus === 'refund_due' ? 'Devolución pendiente' : b.payStatus === 'refunded' ? 'Devuelto' : 'Sin devolución'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{msg}</p>}

      <label className="search">
        <Search size={18} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o ciudad" aria-label="Buscar salas de ensayos" />
      </label>

      {venuesQ.isLoading && <ListSkeleton rows={3} />}
      {venuesQ.error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>No pudimos cargar las salas de ensayos. Revisa tu conexión.</p>}
      {!venuesQ.isLoading && !venuesQ.error && (venues?.length ?? 0) === 0 && (
        <div className="empty">
          <h3>Aún no hay salas de ensayos publicadas</h3>
          <p>Las salas de ensayos que se publiquen en Backline aparecen aquí con sus salas, horarios y precios. ¿Tienes o conoces una? Pídele que la publique.</p>
        </div>
      )}
      {(venues?.length ?? 0) > 0 && shown.length === 0 && <p className="empty">Ninguna sala de ensayos coincide con esa búsqueda.</p>}

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

      <div className="section-title">¿Tienes una sala de ensayos?</div>
      <div className="notice">
        {mine.length > 0
          ? <>Administra tus salas, tus horarios y las reservas. <Link to="/mi-negocio" style={{ color: 'var(--amber)', fontWeight: 600 }}>Ir a mi negocio</Link></>
          : <>Publica tu sala de ensayos en Backline: tus salas, horarios y precios, y recibe reservas de las bandas. <Link to="/mi-negocio" style={{ color: 'var(--amber)', fontWeight: 600 }}>Publicar mi sala de ensayos</Link></>}
      </div>
    </>
  )
}
