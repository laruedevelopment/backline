// Un setlist es una lista ordenada de elementos: canciones (con etiquetas propias) y etiquetas sueltas entre canciones.
export type SetlistItem =
  | { t: 's'; id: string; tags?: string[] }
  | { t: 'l'; id: string; text: string }

import type { Song } from './song'

/** Canción con lo que le toca en el modo escenario: etiquetas sueltas que van antes y después, y sus etiquetas propias. */
export type StageSong = Song & { before?: string[]; after?: string[]; tags?: string[] }

export const MAX_TAGS = 6
export const TAG_MAX_LEN = 24
export const LABEL_MAX_LEN = 60

/** Sugerencias rápidas. */
export const LABEL_PRESETS = ['Afinar a Drop D', 'Volver a E estándar', 'Cambio de guitarra', 'Pausa', 'Intermedio', 'Presentar la banda', 'Bis']
export const TAG_PRESETS = ['Intro largo', 'Sin guitarra', 'Acústica', 'Solo', 'Invitado', 'Con pista', 'Cierre largo']

type ListLike = { songIds: string[]; items?: SetlistItem[] }

/** Los setlists viejos solo tienen canciones: se leen como elementos de canción. */
export function itemsOf(list: ListLike): SetlistItem[] {
  return list.items ?? list.songIds.map((id): SetlistItem => ({ t: 's', id }))
}

/** Guarda los elementos y mantiene `songIds` (solo canciones, en orden). */
export function withItems<T extends ListLike>(list: T, items: SetlistItem[]): T {
  return { ...list, items, songIds: items.flatMap((i) => (i.t === 's' ? [i.id] : [])) }
}

export const cleanTag = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LEN)
export const cleanLabel = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX_LEN)

/** Agrega una etiqueta suelta justo antes del elemento `beforeId` (o al final). */
export function insertLabel(items: SetlistItem[], text: string, beforeId: string | null, id: string = crypto.randomUUID()): SetlistItem[] {
  const label: SetlistItem = { t: 'l', id, text: cleanLabel(text) }
  const at = beforeId ? items.findIndex((i) => i.id === beforeId) : -1
  return at < 0 ? [...items, label] : [...items.slice(0, at), label, ...items.slice(at)]
}

export const setTags = (items: SetlistItem[], songId: string, tags: string[]): SetlistItem[] =>
  items.map((i) => (i.t === 's' && i.id === songId ? { ...i, tags: [...new Set(tags.map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS) } : i))

export const editLabel = (items: SetlistItem[], id: string, text: string): SetlistItem[] =>
  items.map((i) => (i.t === 'l' && i.id === id ? { ...i, text: cleanLabel(text) } : i))

/**
 * Para el modo escenario: a cada canción se le asocian las etiquetas sueltas que van justo antes (`before`),
 * y a la última, las que quedan al final (`after`).
 */
export function stageMarks(items: SetlistItem[]): Map<string, { before: string[]; after: string[]; tags: string[] }> {
  const out = new Map<string, { before: string[]; after: string[]; tags: string[] }>()
  let pending: string[] = []
  let last: string | null = null
  for (const i of items) {
    if (i.t === 'l') { if (i.text) pending.push(i.text); continue }
    out.set(i.id, { before: pending, after: [], tags: i.tags ?? [] })
    pending = []
    last = i.id
  }
  if (last && pending.length) out.get(last)!.after = pending
  return out
}
