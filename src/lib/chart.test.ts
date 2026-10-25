import { describe, expect, it } from 'vitest'
import { isChordLine, parseChart, transposeChord, transposeChordLine, transposeLabel, wrapAligned } from './chart'

describe('acordes', () => {
  it('reconoce líneas de acordes y no confunde letra con acordes', () => {
    expect(isChordLine('Am   F   C   G')).toBe(true)
    expect(isChordLine('F#m7  Bsus4  D/F#  | E')).toBe(true)
    expect(isChordLine('A veces lloro')).toBe(false)
    expect(isChordLine('Em')).toBe(true)
    expect(isChordLine('Amor')).toBe(false)
  })

  it('separa secciones, acordes y letra', () => {
    const c = parseChart('[Verso 1]\nAm      F\nHoy vuelvo a casa\n\nCoro:\nC  G\nVamos')
    expect(c.map((l) => l.kind)).toEqual(['section', 'chords', 'lyric', 'blank', 'section', 'chords', 'lyric'])
    expect(c[0].text).toBe('Verso 1')
    expect(c[4].text).toBe('Coro')
  })

  it('acordes entre corchetes dentro de la letra pasan a una línea encima, alineados', () => {
    const c = parseChart('Hoy [Am]vuelvo a [F]casa')
    expect(c).toEqual([{ kind: 'chords', text: '    Am       F' }, { kind: 'lyric', text: 'Hoy vuelvo a casa' }])
  })

  it('«[Coro]» y «[Cierre]» son secciones, no acordes', () => {
    expect(parseChart('[Coro]\nHola')[0]).toEqual({ kind: 'section', text: 'Coro' })
  })

  it('transpone con sostenidos o bemoles según el acorde y mantiene el bajo', () => {
    expect(transposeChord('Am', 2)).toBe('Bm')
    expect(transposeChord('F#m7/C#', 2)).toBe('G#m7/D#')
    expect(transposeChord('Bb', 2)).toBe('C')
    expect(transposeChord('Eb', -1)).toBe('D')
    expect(transposeChord('C', 12)).toBe('C')
    expect(transposeChord('E', 1)).toBe('F')
  })

  it('transponer una línea conserva la separación entre acordes', () => {
    expect(transposeChordLine('Am    F     C', 1)).toBe('A#m   F#    C#')
  })

  it('etiqueta del tono', () => {
    expect(transposeLabel(0)).toBe('Original')
    expect(transposeLabel(3)).toBe('+3')
    expect(transposeLabel(-2)).toBe('−2')
  })
})

describe('wrapAligned', () => {
  it('parte acorde y letra juntos, en un espacio, sin partir un acorde', () => {
    const chords = 'Am        F          G'
    const lyric = 'Hoy vuelvo a casa otra vez sin ti'
    const parts = wrapAligned([chords, lyric], 16)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.every((r) => r.length <= 16))).toBe(true)
    expect(parts.map((p) => p[1]).join(' ').replace(/\s+/g, ' ')).toBe(lyric)
    expect(parts.flatMap((p) => p[0].split(/\s+/).filter(Boolean))).toEqual(['Am', 'F', 'G'])
  })
  it('no toca lo que ya cabe', () => {
    expect(wrapAligned(['Am', 'Hola'], 20)).toEqual([['Am', 'Hola']])
  })
})
