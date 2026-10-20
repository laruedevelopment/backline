export type SongStatus = 'ready' | 'learning' | 'paused'
export type Tuning = { instrument: string; tuning: string; capo?: number }
export type KeyChange = { section: string; from: string; to: string }

export type Song = {
  id: string
  title: string
  artist: string
  key: string
  bpm: number
  minutes: number
  status: SongStatus
  tunings: Tuning[]
  keyChanges: KeyChange[]
  guest?: string
  links: { youtube?: string; spotify?: string }
  notes?: string
  /** Letra y acordes que se muestran en el modo escenario. */
  lyrics?: string
}

export const statusLabel: Record<SongStatus, string> = { ready: 'Lista', learning: 'Aprendiendo', paused: 'En pausa' }

const tuningText = (t: Tuning) => (t.capo ? `${t.tuning} · capo ${t.capo}` : t.tuning)

/** Texto corto para chips: "Drop D" o "Guitarra: Drop D · Bajo: E estándar". */
export function tuningLabel(song: Song): string {
  const parts = song.tunings.filter((t) => t.tuning.trim())
  if (parts.length === 0) return 'E estándar'
  if (parts.length === 1) return tuningText(parts[0])
  return parts.map((t) => `${t.instrument}: ${tuningText(t)}`).join(' · ')
}

/** Firma para detectar cambios de afinación entre canciones de un setlist. */
export const tuningSignature = (song: Song) => tuningLabel(song).toLowerCase()

const standardTuning = (t: Tuning) => (!t.tuning.trim() || /est[aá]ndar/i.test(t.tuning)) && !t.capo

export const isStandard = (song: Song) => song.tunings.every(standardTuning)

/** Solo lo que se sale de lo normal: "Guitarra: Drop D" (el bajo en estándar no se menciona). */
export function tuningSummary(song: Song): string {
  const odd = song.tunings.filter((t) => !standardTuning(t))
  if (odd.length === 0) return 'E estándar'
  const single = song.tunings.length === 1 || /^(todos|todo)$/i.test(odd[0].instrument.trim())
  return odd.map((t) => (single ? tuningText(t) : `${t.instrument || 'Instrumento'}: ${tuningText(t)}`)).join(' · ')
}

export const keyChangeLabel = (k: KeyChange) => `${k.from} → ${k.to}${k.section ? ` en ${k.section.toLowerCase()}` : ''}`

/** Solo acepta enlaces https de YouTube o Spotify (se usan en href/iframe). */
export function safeLink(url: string | undefined, host: 'youtube' | 'spotify'): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.trim())
    const ok = host === 'youtube' ? /(^|\.)(youtube\.com|youtu\.be)$/ : /(^|\.)spotify\.com$/
    return u.protocol === 'https:' && ok.test(u.hostname) ? u.toString() : undefined
  } catch {
    return undefined
  }
}
