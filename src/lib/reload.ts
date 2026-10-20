export const CHUNK = /dynamically imported module|importing a module script failed|loading chunk|ChunkLoadError|Failed to fetch dynamically/i
const GUARD = 'backline-chunk-reload'

/** Recarga la página una sola vez (cada 30 s como máximo) para tomar la versión nueva. Devuelve true si la lanzó. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(GUARD, String(Date.now()))
  } catch { /* sin sessionStorage: se recarga igual */ }
  window.location.reload()
  return true
}
