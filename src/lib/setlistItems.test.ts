import { describe, expect, it } from 'vitest'
import { insertLabel, itemsOf, setTags, stageMarks, withItems, type SetlistItem } from './setlistItems'

const base = { songIds: ['a', 'b', 'c'] }

describe('elementos del setlist', () => {
  it('un setlist viejo (solo canciones) se lee como elementos de canción', () => {
    expect(itemsOf(base)).toEqual([{ t: 's', id: 'a' }, { t: 's', id: 'b' }, { t: 's', id: 'c' }])
  })

  it('insertar una etiqueta antes de una canción o al final, y songIds sigue siendo solo canciones', () => {
    let items = insertLabel(itemsOf(base), 'Afinar a Drop C', 'b', 'L1')
    expect(items.map((i) => i.id)).toEqual(['a', 'L1', 'b', 'c'])
    items = insertLabel(items, '  Bis  ', null, 'L2')
    expect(items.at(-1)).toEqual({ t: 'l', id: 'L2', text: 'Bis' })
    expect(withItems(base, items).songIds).toEqual(['a', 'b', 'c'])
  })

  it('etiquetas de una canción: limpia, sin repetir y con tope', () => {
    const items = setTags(itemsOf(base), 'b', ['Solo ', 'solo ', 'Solo', ' ', 'a', 'b', 'c', 'd', 'e', 'f'])
    const b = items.find((i) => i.id === 'b') as Extract<SetlistItem, { t: 's' }>
    expect(b.tags).toEqual(['Solo', 'solo', 'a', 'b', 'c', 'd'])
  })

  it('para el escenario: lo suelto va antes de la canción que sigue y lo del final se queda en la última', () => {
    const items: SetlistItem[] = [
      { t: 's', id: 'a', tags: ['Intro largo'] }, { t: 'l', id: 'x', text: 'Pausa' }, { t: 'l', id: 'y', text: 'Cambio de guitarra' },
      { t: 's', id: 'b' }, { t: 'l', id: 'z', text: 'Bis' },
    ]
    const m = stageMarks(items)
    expect(m.get('a')).toEqual({ before: [], after: [], tags: ['Intro largo'] })
    expect(m.get('b')).toEqual({ before: ['Pausa', 'Cambio de guitarra'], after: ['Bis'], tags: [] })
  })
})
