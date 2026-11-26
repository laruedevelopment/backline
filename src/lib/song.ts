export type SongStatus = 'ready' | 'learning' | 'paused'
/** `profileId`: si se pone, esa afinación es solo de esa persona (dos guitarristas con afinaciones distintas). */
/** `shift`: semitonos que se le ponen al pedal de pitch shifter (-2, +1…). El instrumento sigue afinado igual. */
export type Tuning = { instrument: string; tuning: string; capo?: number; shift?: number; profileId?: string }
export type KeyChange = { section: string; from: string; to: string }

import type { MeterId } from './meter'

export type Song = {
  id: string
  title: string
  artist: string
  key: string
  bpm: number
  /** Compás (4/4 si no se indica). */
  meter?: MeterId
  minutes: number
  status: SongStatus
  tunings: Tuning[]
  keyChanges: KeyChange[]
  guest?: string
  links: { youtube?: string; spotify?: string }
  notes?: string
  /** Letra y acordes que se muestran en el modo escenario. */
  lyrics?: string
  /** Notas por instrumento: { Batería: 'entra con el hi-hat' }. */
  instrumentNotes?: Record<string, string>
  /** Quién toca qué en esta canción: un integrante de la banda o un invitado. */
  lineup?: LineupSlot[]
}

export type LineupSlot = { instrument: string; profileId?: string; guest?: string }

export const statusLabel: Record<SongStatus, string> = { ready: 'Lista', learning: 'Aprendiendo', paused: 'En pausa' }

export const shiftText = (n: number) => (n > 0 ? `+${n}` : String(n))
const tuningText = (t: Tuning) => [t.tuning, t.capo ? `capo ${t.capo}` : '', t.shift ? `pitch ${shiftText(t.shift)}` : ''].filter(Boolean).join(' · ')

/** Canciones guardadas antes de tener el campo: «Drop D con Pitch Shifter -1» → afinación «Drop D» y pitch -1. */
export function splitShift(t: Tuning): Tuning {
  if (t.shift) return t
  const m = t.tuning.match(/^(.*?)[\s,+·]*(?:con\s+)?pitch\s*shifter\s*(?:en\s+)?([+\-−–])\s*(\d{1,2})\s*$/i)
  if (!m || !Number(m[3]) || Number(m[3]) > 12) return t
  return { ...t, tuning: m[1].trim() || 'E estándar', shift: (m[2] === '+' ? 1 : -1) * Number(m[3]) }
}

/** Texto corto para chips: "Drop D" o "Guitarra: Drop D · Bajo: E estándar". */
export function tuningLabel(song: Song): string {
  const parts = song.tunings.filter((t) => t.tuning.trim())
  if (parts.length === 0) return 'E estándar'
  if (parts.length === 1) return tuningText(parts[0])
  return parts.map((t) => `${t.instrument}: ${tuningText(t)}`).join(' · ')
}

/** Firma para detectar cambios de afinación entre canciones de un setlist. */
export const tuningSignature = (song: Song) => tuningLabel(song).toLowerCase()

const standardTuning = (t: Tuning) => (!t.tuning.trim() || /est[aá]ndar/i.test(t.tuning)) && !t.capo && !t.shift

export const isStandard = (song: Song) => song.tunings.every(standardTuning)

/** Solo lo que se sale de lo normal: "Guitarra: Drop D" (el bajo en estándar no se menciona). */
export function tuningSummary(song: Song): string {
  const odd = song.tunings.filter((t) => !standardTuning(t))
  if (odd.length === 0) return 'E estándar'
  const single = song.tunings.length === 1 || /^(todos|todo)$/i.test(odd[0].instrument.trim())
  return odd.map((t) => (single ? tuningText(t) : `${t.instrument || 'Instrumento'}: ${tuningText(t)}`)).join(' · ')
}

/** Lo que hay que tener puesto para tocar la canción, separado: afinación del instrumento, capo y pedal de pitch shifter. */
export type Setup = { tuning: string; capo: string; shift: string }
export function setupOf(song: Song): Setup {
  const join = (list: Tuning[], text: (t: Tuning) => string) => {
    const solo = song.tunings.length === 1
    return [...new Set(list.map((t) => (solo || /^todos?$/i.test(t.instrument.trim()) ? text(t) : `${t.instrument || 'Instrumento'}: ${text(t)}`)))].join(' · ')
  }
  const retuned = song.tunings.filter((t) => t.tuning.trim() && !/est[aá]ndar/i.test(t.tuning))
  return {
    tuning: join(retuned, (t) => t.tuning) || 'E estándar',
    capo: join(song.tunings.filter((t) => t.capo), (t) => `traste ${t.capo}`),
    shift: join(song.tunings.filter((t) => t.shift), (t) => shiftText(t.shift!)),
  }
}

/** Lo que hay que hacer para pasar de una canción a la otra, una acción por cada cosa que cambia. */
export type SetupChange = { kind: 'tuning' | 'capo' | 'shift'; text: string }
export function setupChanges(prev: Song, next: Song): SetupChange[] {
  const a = setupOf(prev), b = setupOf(next)
  const out: SetupChange[] = []
  if (a.tuning.toLowerCase() !== b.tuning.toLowerCase()) out.push({ kind: 'tuning', text: b.tuning === 'E estándar' ? 'volver a E estándar' : `reafinar a ${b.tuning}` })
  if (a.capo !== b.capo) out.push({ kind: 'capo', text: b.capo ? `capo en ${b.capo}` : 'quitar el capo' })
  if (a.shift !== b.shift) out.push({ kind: 'shift', text: b.shift ? `pitch shifter en ${b.shift}` : 'apagar el pitch shifter' })
  return out
}

export const keyChangeLabel = (k: KeyChange) => `${k.from} → ${k.to}${k.section ? ` en ${k.section.toLowerCase()}` : ''}`

/** Solo acepta enlaces https de YouTube o Spotify (se usan en href/iframe). */
export function safeLink(url: string | undefined, host: 'youtube' | 'spotify'): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.trim())
    const ok = host === 'youtube' ? /(^|\.)(youtube\.com|youtu\.be)$/ : /(^|\.)(spotify\.com|spotify\.link)$/
    return u.protocol === 'https:' && ok.test(u.hostname) ? u.toString() : undefined
  } catch {
    return undefined
  }
}

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Parte de una frase separada por comas, sin cortar lo que va entre paréntesis. */
function splitParts(body: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.filter(Boolean)
}

/**
 * La nota de la canción sin lo que la tarjeta ya muestra arriba (afinación, tono y BPM). Solo se quita lo que coincide exacto con esos
 * datos; lo demás (observaciones, dudas, versión, duración) se conserva. No cambia lo guardado: es solo para mostrar.
 */
export function usefulNote(song: Song): string {
  const raw = (song.notes ?? '').trim()
  if (!raw) return ''
  const tunings = new Set([tuningSummary(song), tuningLabel(song), ...song.tunings.map((t) => t.tuning)].filter(Boolean).map(plain))
  const key = plain(song.key || '')
  const redundant = (part: string): string | null => {
    const p = plain(part)
    if (tunings.has(p)) return ''
    if (key && p === key) return ''
    const bpm = part.match(/^(\d{2,3})(?:\s*[-–]\s*\d{2,3})?\s*bpm\s*(?:\(([^)]*)\))?$/i)
    if (bpm && Number(bpm[1]) === song.bpm) return bpm[2]?.trim() ?? ''
    const k = part.match(/^([A-G][#b]?m?)\s*\(([^)]*)\)$/)
    if (k && key && plain(k[1]) === key) return k[2].trim()
    return null
  }
  const lines = raw.split(/\r?\n/).map((line) => {
    const sentences = line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/)
    return sentences.map((sentence) => {
      const m = sentence.match(/^([^:]{1,60}):\s*(.+?)\.?$/)
      if (!m) return sentence
      const prefix = m[1].trim()
      const kept: string[] = []
      let changed = false
      for (const part of splitParts(m[2])) {
        const r = redundant(part)
        if (r === null) kept.push(part)
        else { changed = true; if (r) kept.push(r) }
      }
      if (!changed) return sentence
      const onlyOrigin = /^original(\s*\([^)]*\))?$/i.test(prefix)
      if (kept.length === 0) return onlyOrigin ? '' : prefix + '.'
      if (kept.length === 1 && /^\d{1,2}:\d{2}$/.test(kept[0]) && onlyOrigin) return `Duración ${kept[0]}.`
      return `${prefix}: ${kept.join(', ')}.`
    }).filter(Boolean).join(' ')
  }).filter((l) => l.trim())
  return lines.join('\n')
}
