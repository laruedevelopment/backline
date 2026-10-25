import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { clearOfflineLyrics } from './offlineLyrics'

const WEEK = 7 * 24 * 3600_000
const KEY = 'backline-cache-v1'

/** Cliente de datos con caché guardada en el dispositivo: la app abre y muestra lo último sincronizado aunque no haya señal. */
export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime >= maxAge, o la caché guardada se descarta antes de poder restaurarse.
    queries: { staleTime: 30_000, gcTime: WEEK, retry: 1 },
    // Sin señal, guardar falla de una vez (con mensaje) en vez de quedar "Guardando…" para siempre.
    mutations: { networkMode: 'always' },
  },
})

function storage(): Storage | undefined {
  try { return window.localStorage } catch { return undefined }
}

export const persister = createSyncStoragePersister({ storage: storage(), key: KEY, throttleTime: 3000 })

// Solo se guarda en el dispositivo lo que sirve para abrir sin señal. Lo demás (búsquedas de Comunidad, perfiles públicos,
// disponibilidad por día…) crece sin parar, y guardarlo hacía cada vez más lenta la app (se reescribe todo el JSON en el hilo principal).
const PERSISTED = new Set(['bands', 'songs', 'setlists', 'events', 'profile', 'members', 'my-venues', 'venue-bookings', 'venue-rooms', 'venue-hours', 'my-bookings', 'venues'])
export const persistOptions = {
  persister,
  maxAge: WEEK,
  buster: '2',
  dehydrateOptions: { shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])) },
}

// Lo efímero se descarta de la memoria a los 5 minutos de no usarse (el resto se conserva una semana para el modo sin señal).
for (const key of ['explore', 'public-band', 'public-band-members', 'public-musician', 'public-musician-bands', 'busy', 'push-state', 'photos', 'venue-photos', 'calendar-sources', 'song-lyrics', 'song-lyrics-one']) {
  queryClient.setQueryDefaults([key], { gcTime: 5 * 60_000 })
}

/** Al cerrar sesión no queda nada de la banda en el dispositivo (celulares compartidos). */
export function clearLocalCache() {
  queryClient.clear()
  try { localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
  clearOfflineLyrics()
}
