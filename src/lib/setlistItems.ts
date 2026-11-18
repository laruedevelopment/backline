// Un setlist es una lista ordenada de elementos: canciones (con etiquetas propias) y etiquetas sueltas entre canciones.
export type SetlistItem =
  | { t: 's'; id: string; tags?: string[] }
  /** `who`: si se pone, el aviso solo lo ve (en el modo escenario) esa gente; sin eso, toda la banda. */
  | { t: 'l'; id: string; text: string; who?: string[] }

import type { Song } from './song'

/** Canción con lo que le toca en el modo escenario: etiquetas sueltas que van antes y después, y sus etiquetas propias. */
export type StageSong = Song & { before?: string[]; after?: string[]; tags?: string[]; personal?: string; myRole?: string }

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
export function insertLabel(items: SetlistItem[], text: string, beforeId: string | null, id: string = crypto.randomUUID(), who: string[] = []): SetlistItem[] {
  const label: SetlistItem = { t: 'l', id, text: cleanLabel(text), ...(who.length ? { who } : {}) }
  const at = beforeId ? items.findIndex((i) => i.id === beforeId) : -1
  return at < 0 ? [...items, label] : [...items.slice(0, at), label, ...items.slice(at)]
}

export const setTags = (items: SetlistItem[], songId: string, tags: string[]): SetlistItem[] =>
  items.map((i) => (i.t === 's' && i.id === songId ? { ...i, tags: [...new Set(tags.map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS) } : i))

export const editLabel = (items: SetlistItem[], id: string, text: string, who: string[] = []): SetlistItem[] =>
  items.map((i) => {
    if (i.t !== 'l' || i.id !== id) return i
    const { who: _old, ...rest } = i
    void _old
    return { ...rest, text: cleanLabel(text), ...(who.length ? { who } : {}) }
  })

/**
 * Para el modo escenario: a cada canción se le asocian las etiquetas sueltas que van justo antes (`before`),
 * y a la última, las que quedan al final (`after`).
 */
export function stageMarks(items: SetlistItem[], viewer?: string): Map<string, { before: string[]; after: string[]; tags: string[] }> {
  const out = new Map<string, { before: string[]; after: string[]; tags: string[] }>()
  let pending: string[] = []
  let last: string | null = null
  for (const i of items) {
    // Un aviso dirigido a otras personas no sale en la vista de quien no es destinatario.
    if (i.t === 'l') { if (i.text && !(viewer && i.who?.length && !i.who.includes(viewer))) pending.push(i.text); continue }
    out.set(i.id, { before: pending, after: [], tags: i.tags ?? [] })
    pending = []
    last = i.id
  }
  if (last && pending.length) out.get(last)!.after = pending
  return out
}
