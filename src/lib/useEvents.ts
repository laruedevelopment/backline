import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteEvent, listEvents, setRsvp, upsertEvent, type BandEvent, type RsvpStatus } from './api'

export function useEvents(bandId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient()
  const key = ['events', bandId]
  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const query = useQuery({ queryKey: key, queryFn: () => listEvents(bandId!), enabled: !!bandId })
  const save = useMutation({ mutationFn: (e: Omit<BandEvent, 'rsvps'>) => upsertEvent(bandId!, e), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (id: string) => deleteEvent(id), onSuccess: invalidate })
  const rsvp = useMutation({ mutationFn: (v: { eventId: string; status: RsvpStatus }) => setRsvp(v.eventId, userId!, v.status), onSuccess: invalidate })

  return {
    events: query.data ?? [],
    loading: query.isLoading,
    error: query.error || save.error || remove.error || rsvp.error ? 'No pudimos sincronizar la agenda. Intenta de nuevo.' : '',
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    rsvp: (eventId: string, status: RsvpStatus) => rsvp.mutate({ eventId, status }),
  }
}

/** Eventos que aún no pasan (con 3 h de margen para el que está en curso). */
export const isUpcoming = (e: BandEvent) => new Date(e.startsAt).getTime() > Date.now() - 3 * 3600_000

export const dayParts = (iso: string) => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('es-CO', { day: 'numeric' }),
    month: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
    long: ((t) => t.charAt(0).toUpperCase() + t.slice(1))(d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })),
    time: d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }),
  }
}

/** ISO → valor para <input type="datetime-local"> en hora local. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
