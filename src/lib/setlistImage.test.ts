import { describe, expect, it } from 'vitest'
import fixture from './fixtures/setlist-toke-kabaret.json'
import { normalizeTuning, parseSetlistLayout, type OcrLine } from './setlistImage'

const lines = fixture.lines as OcrLine[]

describe('parseSetlistLayout con una lista diseñada real (captura de WhatsApp)', () => {
  const r = parseSetlistLayout(lines, fixture.width)!

  it('reconoce el nombre del setlist sin leyendas ni «SETLIST»', () => {
    expect(r.name).toBe('Toke Kabaret · Cierre 2026')
  })

  it('encuentra las 16 canciones en orden, sin colar la leyenda ni basura', () => {
    expect(r.rows.map((x) => x.title)).toEqual([
      'Last Resort', 'Given Up', 'Unholy Confessions', 'Toxicity', 'Aerials', 'Lonely Day', 'Snuff', 'Cemetery Gates',
      'Me Llevas', 'For Whom the Bell Tolls', 'Puntos Suspensivos', 'Judith', 'One Step Closer', 'The Diary of Jane', 'Chapter Four', 'Nightmare',
    ])
  })

  it('separa el artista del título', () => {
    expect(r.rows[0]).toMatchObject({ title: 'Last Resort', artist: 'Papa Roach' })
    expect(r.rows[6].artist).toBe('Slipknot · acústica')
    expect(r.rows[13].artist).toBe('Breaking Benjamin')
  })

  it('las canciones sin artista (las propias) quedan sin artista, no con la nota', () => {
    expect(r.rows[8]).toMatchObject({ title: 'Me Llevas', artist: '' })
    expect(r.rows[10]).toMatchObject({ title: 'Puntos Suspensivos', artist: '' })
  })

  it('lee la afinación de cada etiqueta de la derecha', () => {
    expect(r.rows.map((x) => x.tuning)).toEqual([
      'Drop D', 'Drop D', 'Drop D', 'Drop D', 'Drop D', 'Drop D', 'E estándar', 'E estándar',
      'E estándar', 'E estándar', 'E estándar', 'Drop D', 'Drop D', 'Drop D', 'Drop D', 'Drop D',
    ])
  })

  it('guarda las notas en amarillo como notas de la canción, bien escritas', () => {
    expect(r.rows[3].notes).toBe('+1 tono · original en Drop C')
    expect(r.rows[5].notes).toBe('+½ tono · original en Drop C#')
    expect(r.rows[6].notes).toContain('Tono original, acordes reacomodados')
    expect(r.rows[0].notes).toBe('')
  })
})

describe('parseSetlistLayout: casos límite', () => {
  const L = (text: string, x0: number, y0: number, h = 30, x1 = x0 + 200): OcrLine => ({ text, bbox: { x0, y0, x1, y1: y0 + h }, words: [] })

  it('devuelve null si no parece una lista (para usar el lector de texto simple)', () => {
    expect(parseSetlistLayout([L('Hola', 10, 10), L('Mundo', 10, 60)], 800)).toBeNull()
    expect(parseSetlistLayout([], 800)).toBeNull()
  })

  it('una lista simple sin artistas ni etiquetas: cada línea es una canción', () => {
    const simple = ['Come Together', 'Black Hole Sun', 'Wonderwall', 'Smooth Operator'].map((t, i) => L(t, 100, 100 + i * 70))
    const r = parseSetlistLayout(simple, 800)!
    expect(r.rows.map((x) => x.title)).toEqual(['Come Together', 'Black Hole Sun', 'Wonderwall', 'Smooth Operator'])
    expect(r.rows.every((x) => x.tuning === '' && x.artist === '')).toBe(true)
  })
})

describe('normalizeTuning', () => {
  it('entiende las etiquetas más comunes', () => {
    expect(normalizeTuning('DROP D')).toBe('Drop D')
    expect(normalizeTuning('DROPD')).toBe('Drop D')
    expect(normalizeTuning('Drop C#')).toBe('Drop C#')
    expect(normalizeTuning('ESTÁNDAR')).toBe('E estándar')
    expect(normalizeTuning('hola')).toBe('')
  })
})
