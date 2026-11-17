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

describe('listas de Spotify', () => {
  it('lee un CSV exportado con comillas y varios artistas', () => {
    const r = parseSetlistText('Track URI,Track Name,Artist Name(s),Album Name\nspotify:track:1,"Come Together - Remastered 2009",The Beatles,Abbey Road\nspotify:track:2,"Hola, mundo","Artista Uno;Artista Dos",Disco')
    expect(r.lines.map((l) => [l.title, l.artist])).toEqual([['Come Together - Remastered 2009', 'The Beatles'], ['Hola, mundo', 'Artista Uno']])
  })
  it('lee filas con tabuladores pegadas desde la app de escritorio', () => {
    const r = parseSetlistText('1\tSeven Nation Army\tThe White Stripes\tElephant\t3:51\n2\tSuperstition\tStevie Wonder\tTalking Book\t4:26')
    expect(r.lines.map((l) => [l.title, l.artist])).toEqual([['Seven Nation Army', 'The White Stripes'], ['Superstition', 'Stevie Wonder']])
  })
  it('junta título y artista en líneas seguidas, ignorando números, duraciones y la marca E', () => {
    const r = parseSetlistText('Seven Nation Army\nThe White Stripes\n3:51\nCome Together\nE The Beatles\n4:19\nSuperstition\nStevie Wonder\n4:26\nBlack Hole Sun\nSoundgarden\n5:18')
    expect(r.lines.map((l) => [l.title, l.artist])).toEqual([['Seven Nation Army', 'The White Stripes'], ['Come Together', 'The Beatles'], ['Superstition', 'Stevie Wonder'], ['Black Hole Sun', 'Soundgarden']])
  })
  it('no confunde una lista normal «título - artista»', () => {
    const r = parseSetlistText('1. Seven Nation Army - The White Stripes\n2. Come Together - The Beatles\n3. Superstition - Stevie Wonder\n4. Wonderwall - Oasis')
    expect(r.lines).toHaveLength(4)
    expect(r.lines[0]).toEqual({ title: 'Seven Nation Army', artist: 'The White Stripes' })
  })
})
