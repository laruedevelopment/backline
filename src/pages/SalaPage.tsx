import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import BandMark from '../components/BandMark'
import BookingSheet from '../components/BookingSheet'
import ListSkeleton from '../components/Skeleton'
import VenueMedia from '../components/VenueMedia'
import { waLink } from '../lib/identity'
import { safeSocials, socialLabels } from '../lib/links'
import { money, weekOrder, weekdayNames } from '../lib/slots'
import { getVenue, kindLabel, listHours, listRooms } from '../lib/venues'
import { useAuth } from '../store/useAuth'

const hm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

export default function SalaPage() {
  const { id } = useParams()
  const userId = useAuth((s) => s.session?.user.id)
  const [booking, setBooking] = useState<string | null>(null)

  const venueQ = useQuery({ queryKey: ['venue', id], queryFn: () => getVenue(id!), enabled: !!id })
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', id], queryFn: () => listRooms(id!), enabled: !!id })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', id], queryFn: () => listHours(id!), enabled: !!id })

  if (venueQ.isLoading) return <ListSkeleton rows={4} />
  const venue = venueQ.data
  if (!venue) {
    return <p className="empty">Esa sala no está disponible. <Link to="/salas" style={{ color: 'var(--amber)' }}>Volver a salas</Link></p>
  }

  const isOwner = venue.ownerId === userId
  const wa = waLink(venue.whatsapp, `Hola, vi ${venue.name} en Backline y quisiera preguntar por una reserva.`)
  const socials = safeSocials(venue.links)
  const canBook = venue.isPublished && !isOwner && rooms.length > 0 && hours.length > 0
  const byDay = new Map(hours.map((h) => [h.weekday, h]))

  return (
    <>
      <Link to="/salas" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Salas</Link>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16, paddingTop: 6 }}>
        <BandMark name={venue.name} logoUrl={venue.logoUrl} size="lg" />
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{kindLabel[venue.kind]}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{venue.name}</h1>
        </div>
      </div>
      <p className="page-sub">{[venue.address, venue.city].filter(Boolean).join(' · ')}</p>

      {isOwner && (
        <p className="notice" style={{ marginTop: 12 }}>
          {venue.isPublished ? 'Así ven tu sala las bandas.' : 'Tu sala aún no está publicada: solo tú la ves.'}{' '}
          <Link to="/mi-sala" style={{ color: 'var(--amber)', fontWeight: 600 }}>Administrar</Link>
        </p>
      )}
      {venue.description && <p style={{ marginTop: 14, maxWidth: '60ch', whiteSpace: 'pre-line' }}>{venue.description}</p>}
      {venue.amenities.length > 0 && <div className="chips">{venue.amenities.map((a) => <span key={a} className="tag">{a}</span>)}</div>}

      <div className="links-row" style={{ marginTop: 14 }}>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {venue.bookingUrl && <a href={venue.bookingUrl} target="_blank" rel="noopener noreferrer">Reservar en su sistema</a>}
        {socials.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{socialLabels[k]}</a>)}
      </div>

      <div className="section-title">Salitas y precios</div>
      {rooms.length === 0 && <p className="li-sub wrap">Esta sala aún no ha cargado sus salitas.</p>}
      <div className="list">
        {rooms.map((r) => (
          <div key={r.id} className="li" style={{ alignItems: 'flex-start' }}>
            <div className="li-main">
              <div className="li-title">{r.name}</div>
              <div className="li-sub">Hasta {r.capacity} personas</div>
              {r.description && <div className="li-sub wrap">{r.description}</div>}
            </div>
            <div className="readout"><b>{money(r.pricePerHour)}</b>{r.pricePerHour ? 'por hora' : ''}</div>
            {canBook && <button className="btn primary" onClick={() => setBooking(r.id)}>Reservar</button>}
          </div>
        ))}
      </div>
      {!canBook && !isOwner && venue.isPublished && rooms.length > 0 && hours.length === 0 && <p className="li-sub wrap" style={{ marginTop: 8 }}>La sala aún no tiene horario cargado: escríbele por WhatsApp para reservar.</p>}

      <div className="section-title">Horario</div>
      <div className="kv" style={{ maxWidth: 360 }}>
        {weekOrder.map((d) => {
          const h = byDay.get(d)
          return (
            <div key={d} style={{ display: 'contents' }}>
              <span>{weekdayNames[d]}</span>
              <span className="readout" style={{ textAlign: 'right', color: h ? undefined : 'var(--muted)' }}>{h ? `${hm(h.opens)} – ${hm(h.closes)}` : 'Cerrado'}</span>
            </div>
          )
        })}
      </div>

      <VenueMedia venue={venue} canEdit={false} />

      {booking && <BookingSheet venue={venue} rooms={rooms} hours={hours} initialRoomId={booking} onClose={() => setBooking(null)} />}
    </>
  )
}
