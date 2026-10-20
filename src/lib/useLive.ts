import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { myVenues, venueBookings } from './venues'
import { useAuth } from '../store/useAuth'

/**
 * Actualiza la app al instante cuando cambia una reserva (llega una solicitud, el dueño responde, se ocupa una franja).
 * Supabase Realtime solo entrega las filas que esa persona tiene permiso de leer.
 */
export function useLiveBookings() {
  const qc = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('bookings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        for (const key of ['my-bookings', 'venue-bookings', 'busy', 'events']) void qc.invalidateQueries({ queryKey: [key] })
      })
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [qc])
}

/** Solicitudes de reserva por responder en la sala del usuario (0 si no tiene sala). */
export function usePendingRequests() {
  const userId = useAuth((s) => s.session?.user.id)
  const [now] = useState(() => new Date())
  const venues = useQuery({ queryKey: ['my-venues', userId], queryFn: () => myVenues(userId!), enabled: !!userId && !!supabase })
  const venue = venues.data?.[0]
  const bookings = useQuery({ queryKey: ['venue-bookings', venue?.id], queryFn: () => venueBookings(venue!.id), enabled: !!venue })
  const count = (bookings.data ?? []).filter((b) => b.status === 'requested' && new Date(b.endsAt) > now).length
  return { count, venue }
}
