// Cómo se relaciona lo que toca cada integrante con la información de una canción.
import type { Song, Tuning } from './song'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** «Guitarra» coincide con «Guitarra eléctrica» y con «guitarra». «Todos» coincide con cualquiera. */
export function sameInstrument(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === 'todos' || x === 'todo' || y === 'todos' || y === 'todo') return true
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)
}

/** Qué necesita ver cada tipo de instrumento: la batería no lee acordes y la voz sí lee letra pero no acordes. */
export type Kind = 'rhythm' | 'voice' | 'melodic'
export function instrumentKind(instrument: string): Kind {
  const n = norm(instrument)
  if (/^(bateria|percusion|cajon)/.test(n)) return 'rhythm'
  if (/^(voz|cantante|vocal|coros)/.test(n)) return 'voice'
  return 'melodic'
}

/** Afinaciones que le tocan a este instrumento (las de «Todos» también). */
export const tuningsFor = (song: Song, instrument: string): Tuning[] => song.tunings.filter((t) => sameInstrument(t.instrument, instrument))

/** Nota escrita para este instrumento, si hay. */
export function noteFor(song: Song, instrument: string): string {
  const entry = Object.entries(song.instrumentNotes ?? {}).find(([k]) => sameInstrument(k, instrument) && norm(k) !== 'todos')
  return entry?.[1]?.trim() ?? ''
}

/** Notas de los demás instrumentos (para la vista «Todo»). */
export const otherNotes = (song: Song, instrument?: string | null): [string, string][] =>
  Object.entries(song.instrumentNotes ?? {}).filter(([k, v]) => v.trim() && !(instrument && sameInstrument(k, instrument)))
