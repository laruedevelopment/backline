// Letras guardadas en el dispositivo para tocar sin señal. Solo las de las canciones de los setlists abiertos (pocas decenas de KB).
const KEY = 'backline-offline-lyrics'
const MAX = 300

export function loadOfflineLyrics(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string> } catch { return {} }
}

/** Guarda (o actualiza) las letras de estas canciones. Devuelve cuántas quedaron guardadas, o -1 si el dispositivo no deja guardar. */
export function saveOfflineLyrics(entries: Record<string, string>): number {
  const merged = { ...loadOfflineLyrics(), ...entries }
  const ids = Object.keys(merged)
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX))) delete merged[id]
  try { localStorage.setItem(KEY, JSON.stringify(merged)); return Object.keys(entries).length } catch { return -1 }
}

export const clearOfflineLyrics = () => { try { localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ } }
