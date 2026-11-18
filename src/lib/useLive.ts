import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { myVenues, venueBookings } from './venues'
import { unreadMessages, type Post } from './api'
import { listFriends } from './social'
import { useAuth } from '../store/useAuth'

/**
 * Actualiza la app al instante cuando cambia una reserva (llega una solicitud, el dueño responde, se ocupa una franja).
 * Supabase Realtime solo entrega las filas que esa persona tiene permiso de leer.
 */
export function useLiveBookings(enabled = true) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!supabase || !enabled) return
    const channel = supabase
      .channel('bookings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        for (const key of ['my-bookings', 'venue-bookings', 'busy', 'events']) void qc.invalidateQueries({ queryKey: [key] })
      })
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [qc, enabled])
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


/** Chat y comentarios de la banda activa al instante: el mensaje nuevo se agrega a la caché (sin volver a bajar toda la conversación). */
export function useLiveChat(bandId: string | undefined) {
  const qc = useQueryClient()
  const userId = useAuth((s) => s.session?.user.id)
  useEffect(() => {
    if (!supabase || !bandId) return
    type Row = { id: string; profile_id: string; body: string; created_at: string; song_id?: string }
    const toPost = (r: Row): Post => ({ id: r.id, profileId: r.profile_id, body: r.body, createdAt: r.created_at })
    const add = (key: unknown[], r: Row) => qc.setQueryData<Post[]>(key, (old) => (old && !old.some((p) => p.id === r.id) ? [...old, toPost(r)].slice(-100) : old))
    const drop = (key: unknown[], id: string) => qc.setQueryData<Post[]>(key, (old) => old?.filter((p) => p.id !== id))
    const channel = supabase
      .channel(`chat-${bandId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'band_messages', filter: `band_id=eq.${bandId}` }, (e) => {
        const r = e.new as Row
        add(['band-messages', bandId], r)
        if (r.profile_id !== userId) qc.setQueryData<number>(['chat-unread', bandId, userId], (n) => (n ?? 0) + 1)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'band_messages', filter: `band_id=eq.${bandId}` }, (e) => drop(['band-messages', bandId], (e.old as { id: string }).id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'song_comments', filter: `band_id=eq.${bandId}` }, (e) => { const r = e.new as Row; if (r.song_id) add(['song-comments', r.song_id], r) })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'song_comments', filter: `band_id=eq.${bandId}` }, () => { void qc.invalidateQueries({ queryKey: ['song-comments'] }) })
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [qc, bandId, userId])
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
