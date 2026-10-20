import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PushPrompt } from '../../components/PushControls'
import ListSkeleton from '../../components/Skeleton'
import { VenueForm } from '../../components/VenueForms'
import { createVenue, myVenues } from '../../lib/venues'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/useAuth'
import BusinessBookings from './Bookings'
import { VenueContext } from './BusinessContext'
import BusinessProfile from './Profile'
import BusinessRooms from './Rooms'
import BusinessToday from './Today'

/** Área «Mi negocio»: el otro sombrero del usuario. Tiene su propia navegación (Hoy, Reservas, Salas, Ensayadero). */
export default function BusinessLayout() {
  const userId = useAuth((s) => s.session?.user.id)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const { data: venues, isLoading } = useQuery({ queryKey: ['my-venues', userId], queryFn: () => myVenues(userId!), enabled: !!userId && !!supabase })

  if (!supabase) {
    return (
      <>
        <div className="page-head"><span className="eyebrow">Modo demostración</span><h1 className="page-title">Mi negocio</h1></div>
        <p className="notice">Ingresa con tu cuenta para publicar tu ensayadero.</p>
      </>
    )
  }
  if (isLoading) return <ListSkeleton rows={4} />
  const venue = venues?.[0]

  if (!venue) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Para dueños de ensayaderos</span>
          <h1 className="page-title">Publica tu ensayadero</h1>
          <p className="page-sub">Las bandas de tu ciudad ven tus salas, tus precios y tus horarios, y te piden una franja. Tú confirmas o rechazas, o dejas que se confirme sola.</p>
        </div>
        <div className="stack">
          <ul className="steps" style={{ gap: 10 }}>
            <li>Cargas tus salas, los horarios y los precios.</li>
            <li>Opcional: conectas tu Google Calendar y lo que ya anotas allí bloquea esas horas solo.</li>
            <li>Las bandas reservan desde el celular y te llega un aviso.</li>
          </ul>
          <p className="notice">Es gratis. El pago se hace en el ensayadero, como siempre. Sigues teniendo tus bandas: cambias entre tu banda y tu negocio desde la barra de arriba.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>Publicar mi ensayadero</button>
          <Link to="/ensayaderos" className="link-btn">Ver los ensayaderos publicados</Link>
        </div>
        {creating && (
          <VenueForm
            onClose={() => setCreating(false)}
            onSave={async (d) => { await createVenue(d); await qc.invalidateQueries({ queryKey: ['my-venues'] }) }}
          />
        )}
      </>
    )
  }

  return (
    <VenueContext.Provider value={venue}>
      <PushPrompt text="Activa los avisos para enterarte al instante cuando una banda pida o cancele una reserva." />
      <Routes>
        <Route index element={<BusinessToday />} />
        <Route path="reservas" element={<BusinessBookings />} />
        <Route path="salas" element={<div className="measure"><BusinessRooms /></div>} />
        <Route path="perfil" element={<div className="measure"><BusinessProfile /></div>} />
        <Route path="*" element={<BusinessToday />} />
      </Routes>
    </VenueContext.Provider>
  )
}
