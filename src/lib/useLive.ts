import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { myVenues, venueBookings } from './venues'
import { unreadMessages } from './api'
import { listFriends } from './social'
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

/** Solicitudes de reserva por responder en el negocio del usuario (0 si no tiene uno). */
export function usePendingRequests() {
  const userId = useAuth((s) => s.session?.user.id)
  const [now] = useState(() => new Date())
  const venues = useQuery({ queryKey: ['my-venues', userId], queryFn: () => myVenues(userId!), enabled: !!userId && !!supabase })
  const venue = venues.data?.[0]
  const bookings = useQuery({ queryKey: ['venue-bookings', venue?.id], queryFn: () => venueBookings(venue!.id), enabled: !!venue })
  const count = (bookings.data ?? []).filter((b) => b.status === 'requested' && new Date(b.endsAt) > now).length
  return { count, venue }
}


/** Chat y comentarios de la banda activa al instante (una sola suscripción mientras la app está abierta). */
export function useLiveChat(bandId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!supabase || !bandId) return
    const refresh = (keys: string[]) => () => { for (const key of keys) void qc.invalidateQueries({ queryKey: [key] }) }
    const channel = supabase
      .channel(`chat-${bandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'band_messages', filter: `band_id=eq.${bandId}` }, refresh(['band-messages', 'chat-unread']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_comments', filter: `band_id=eq.${bandId}` }, refresh(['song-comments']))
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [qc, bandId])
}

/** Mensajes sin leer del chat de la banda activa (para el contador de la navegación). */
export function useChatUnread(bandId: string | undefined): number {
  const userId = useAuth((s) => s.session?.user.id)
  const { data = 0 } = useQuery({ queryKey: ['chat-unread', bandId, userId], queryFn: () => unreadMessages(bandId!, userId!), enabled: !!supabase && !!bandId && !!userId, staleTime: 60_000 })
  return data
}

/** Amistades y mensajes directos al instante. */
export function useLiveSocial() {
  const qc = useQueryClient()
  const userId = useAuth((s) => s.session?.user.id)
  useEffect(() => {
    if (!supabase || !userId) return
    const refresh = () => { for (const key of ['friends', 'dm']) void qc.invalidateQueries({ queryKey: [key] }) }
    const channel = supabase
      .channel(`social-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `recipient=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${userId}` }, refresh)
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [qc, userId])
}

/** Amigos y solicitudes (la lista completa; también da el contador de pendientes de la navegación). */
export function useFriends() {
  const userId = useAuth((s) => s.session?.user.id)
  return useQuery({ queryKey: ['friends', userId], queryFn: listFriends, enabled: !!supabase && !!userId, staleTime: 60_000 })
}

/** Mensajes sin leer + solicitudes por responder. */
export function useSocialBadge(): number {
  const { data = [] } = useFriends()
  return data.reduce((n, f) => n + f.unread + (f.direction === 'in' ? 1 : 0), 0)
}
