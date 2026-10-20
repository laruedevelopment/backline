import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import BandMark from '../components/BandMark'
import BookingSheet from '../components/BookingSheet'
import ListSkeleton from '../components/Skeleton'
import VenueMedia from '../components/VenueMedia'
import { byRoom, detailLine, dimensionsLabel, includedChips, quantityLabel, rentals, unitLabel } from '../lib/equipment'
import { mapLinks, osmEmbedUrl } from '../lib/geo'
import { waLink } from '../lib/identity'
import { safeSocials, socialLabels } from '../lib/links'
import { money, weekOrder, weekdayNames } from '../lib/slots'
import { getVenue, kindLabel, listEquipment, listHours, listRooms } from '../lib/venues'
import { useAuth } from '../store/useAuth'

const hm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

export default function EnsayaderoPage() {
  const { id } = useParams()
  const userId = useAuth((s) => s.session?.user.id)
  const [booking, setBooking] = useState<string | null>(null)
  const [map, setMap] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const venueQ = useQuery({ queryKey: ['venue', id], queryFn: () => getVenue(id!), enabled: !!id })
  const { data: rooms = [] } = useQuery({ queryKey: ['venue-rooms', id], queryFn: () => listRooms(id!), enabled: !!id })
  const { data: hours = [] } = useQuery({ queryKey: ['venue-hours', id], queryFn: () => listHours(id!), enabled: !!id })
  const { data: equipment = [] } = useQuery({ queryKey: ['equipment', id], queryFn: () => listEquipment(id!), enabled: !!id })
  const equipByRoom = byRoom(equipment)

  if (venueQ.isLoading) return <ListSkeleton rows={4} />
  const venue = venueQ.data
  if (!venue) {
    return <p className="empty">Esa sala de ensayos no está disponible. <Link to="/ensayaderos" style={{ color: 'var(--amber)' }}>Volver a salas de ensayos</Link></p>
  }

  const isOwner = venue.ownerId === userId
  const wa = waLink(venue.whatsapp, `Hola, vi ${venue.name} en Backline y quisiera preguntar por una reserva.`)
  const socials = safeSocials(venue.links)
  const canBook = venue.isPublished && !isOwner && rooms.length > 0 && hours.length > 0
  const byDay = new Map(hours.map((h) => [h.weekday, h]))

  return (
    <>
      <Link to="/ensayaderos" className="back" style={{ marginTop: 8 }}><ArrowLeft size={18} aria-hidden /> Salas de ensayos</Link>
      <div className="page-head" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 16, paddingTop: 6 }}>
        <BandMark name={venue.name} logoUrl={venue.logoUrl} size="lg" />
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{kindLabel[venue.kind]}</span>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.6rem)' }}>{venue.name}</h1>
        </div>
      </div>
      <p className="page-sub">{[venue.address, venue.city].filter(Boolean).join(' · ')}</p>
      {venue.lat != null && venue.lng != null && (
        <div className="links-row" style={{ marginTop: 10 }}>
          {(() => { const l = mapLinks({ lat: venue.lat!, lng: venue.lng! }, venue.name); return (
            <>
              <button className="btn" onClick={() => setMap(!map)} aria-expanded={map}>{map ? 'Ocultar el mapa' : 'Ver en el mapa'}</button>
              <a href={l.google} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
              <a href={l.waze} target="_blank" rel="noopener noreferrer">Waze</a>
            </>
          ) })()}
        </div>
      )}
      {map && venue.lat != null && venue.lng != null && (
        <div className="player" style={{ marginTop: 10 }}>
          <iframe title={`Mapa de ${venue.name}`} src={osmEmbedUrl({ lat: venue.lat, lng: venue.lng })} height={260} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
          <a className="player-link" href={mapLinks({ lat: venue.lat, lng: venue.lng }, venue.name).osm} target="_blank" rel="noopener noreferrer">Abrir en OpenStreetMap</a>
        </div>
      )}

      {isOwner && (
        <p className="notice" style={{ marginTop: 12 }}>
          {venue.isPublished ? 'Así ven tu sala de ensayos las bandas.' : 'Tu sala de ensayos aún no está publicada: solo tú la ves.'}{' '}
          <Link to="/mi-negocio/perfil" style={{ color: 'var(--amber)', fontWeight: 600 }}>Administrar</Link>
        </p>
      )}
      {venue.description && <p style={{ marginTop: 14, maxWidth: '60ch', whiteSpace: 'pre-line' }}>{venue.description}</p>}
      {venue.amenities.length > 0 && <div className="chips">{venue.amenities.map((a) => <span key={a} className="tag">{a}</span>)}</div>}

      <div className="links-row" style={{ marginTop: 14 }}>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {venue.bookingUrl && <a href={venue.bookingUrl} target="_blank" rel="noopener noreferrer">Reservar en su sistema</a>}
        {socials.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noopener noreferrer">{socialLabels[k]}</a>)}
      </div>

      <div className="section-title">Salas y precios</div>
      {rooms.length === 0 && <p className="li-sub wrap">Esta sala de ensayos aún no ha cargado sus salas.</p>}
      <div className="list">
        {rooms.map((r) => {
          const items = equipByRoom.get(r.id) ?? []
          const dims = dimensionsLabel(r)
          const extra = rentals(items)
          return (
            <div key={r.id} className="li" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="li-main" style={{ minWidth: 180 }}>
                <div className="li-title">{r.name}</div>
                <div className="li-sub">Hasta {r.capacity} personas{dims ? ` · ${dims}` : ''}</div>
                {r.description && <div className="li-sub wrap">{r.description}</div>}
                {includedChips(items).length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginTop: 10 }}>Incluye</div>
                    <div className="chips" style={{ marginTop: 4 }}>{includedChips(items).map((c) => <span key={c} className="tag">{c}</span>)}</div>
                  </>
                )}
                {extra.length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginTop: 10 }}>Alquiler aparte</div>
                    <div className="li-sub wrap">{extra.map((x) => `${x.label}${x.price != null ? ` (${money(x.price)} ${unitLabel[x.unit]})` : ' (consultar)'}`).join(' · ')}</div>
                  </>
                )}
                {items.length > 0 && (
                  <button className="link-btn" style={{ minHeight: 36, padding: 0, justifySelf: 'start' }} onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                    {open === r.id ? 'Ocultar el detalle del equipo' : 'Ver el equipo en detalle'}
                  </button>
                )}
                {open === r.id && (
                  <ul className="equip-detail">
                    {items.map((e) => (
                      <li key={e.id}>
                        <b>{quantityLabel(e)}</b>{detailLine(e) ? ` · ${detailLine(e)}` : ''}
                        {!e.included && <span className="tag" style={{ marginLeft: 6 }}>{e.extraPrice != null ? `${money(e.extraPrice)} ${unitLabel[e.extraUnit]}` : 'Alquiler: consultar'}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="readout"><b>{money(r.pricePerHour)}</b>{r.pricePerHour ? 'por hora' : ''}</div>
              {canBook && <button className="btn primary" onClick={() => setBooking(r.id)}>Reservar</button>}
            </div>
          )
        })}
      </div>
      {!canBook && !isOwner && venue.isPublished && rooms.length > 0 && hours.length === 0 && <p className="li-sub wrap" style={{ marginTop: 8 }}>La sala de ensayos aún no tiene horario cargado: escríbele por WhatsApp para reservar.</p>}

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
