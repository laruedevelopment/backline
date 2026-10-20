import { describe, expect, it } from 'vitest'
import { matchSongs, norm, parseSetlistText } from './importSetlist'
import type { Song } from './song'

describe('parseSetlistText', () => {
  it('entiende numeración, emojis, artista con guion o paréntesis y salta links y repetidas', () => {
    const r = parseSetlistText(`[10:32, 3/10/2026] Sebas: Setlist Bar La Esquina:
1. Seven Nation Army - The White Stripes
2) Come Together (Beatles)
🎸 Black Hole Sun
- Smooth Operator – Sade
https://youtu.be/xyz
seven nation army - the white stripes
Wonderwall`)
    expect(r.name).toBe('Bar La Esquina')
    expect(r.lines).toEqual([
      { title: 'Seven Nation Army', artist: 'The White Stripes' },
      { title: 'Come Together', artist: 'Beatles' },
      { title: 'Black Hole Sun', artist: '' },
      { title: 'Smooth Operator', artist: 'Sade' },
      { title: 'Wonderwall', artist: '' },
    ])
  })

  it('devuelve vacío con texto sin canciones', () => {
    expect(parseSetlistText('\n  \n').lines).toEqual([])
  })

  it('recorta títulos y artistas largos', () => {
    const long = 'a'.repeat(300)
    const [l] = parseSetlistText(`${long} - ${long}`).lines
    expect(l.title.length).toBeLessThanOrEqual(120)
    expect(l.artist.length).toBeLessThanOrEqual(120)
  })
})

describe('norm / matchSongs', () => {
  it('ignora tildes, mayúsculas y signos', () => {
    expect(norm('  Qué  Será?! ')).toBe('que sera')
  })

  it('empareja por título normalizado', () => {
    const songs = [{ id: '1', title: 'Come Together' }] as Song[]
    const [a, b] = matchSongs([{ title: 'come together', artist: '' }, { title: 'Otra', artist: '' }], songs)
    expect(a.song?.id).toBe('1')
    expect(b.song).toBeUndefined()
  })
})
