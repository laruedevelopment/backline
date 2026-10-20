import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

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

export const persister = createSyncStoragePersister({ storage: storage(), key: KEY, throttleTime: 1000 })
export const persistOptions = { persister, maxAge: WEEK, buster: '1' }

/** Al cerrar sesión no queda nada de la banda en el dispositivo (celulares compartidos). */
export function clearLocalCache() {
  queryClient.clear()
  try { localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
}
