import { describe, expect, it } from 'vitest'
import { instrumentKind, noteFor, otherNotes, sameInstrument, tuningsFor } from './instrument'
import type { Song } from './song'

const song: Song = {
  id: '1', title: 'T', artist: 'A', key: '', bpm: 100, minutes: 4, status: 'ready', links: {}, keyChanges: [],
  tunings: [{ instrument: 'Guitarra', tuning: 'Drop D' }, { instrument: 'Bajo', tuning: 'E estándar' }],
  instrumentNotes: { Batería: 'entra con el hi-hat', Bajo: 'dedos, no púa' },
}

describe('instrumentos', () => {
  it('relaciona nombres parecidos y «Todos»', () => {
    expect(sameInstrument('Guitarra', 'guitarra eléctrica')).toBe(true)
    expect(sameInstrument('Bajo', 'Batería')).toBe(false)
    expect(sameInstrument('Todos', 'Voz')).toBe(true)
    expect(sameInstrument('', 'Voz')).toBe(false)
  })
  it('clasifica qué necesita ver cada instrumento', () => {
    expect(instrumentKind('Batería')).toBe('rhythm')
    expect(instrumentKind('Percusión')).toBe('rhythm')
    expect(instrumentKind('Voz')).toBe('voice')
    expect(instrumentKind('Guitarra')).toBe('melodic')
    expect(instrumentKind('Teclado / piano')).toBe('melodic')
  })
  it('afinación y nota de cada quien', () => {
    expect(tuningsFor(song, 'Guitarra').map((t) => t.tuning)).toEqual(['Drop D'])
    expect(tuningsFor(song, 'Batería')).toEqual([])
    expect(noteFor(song, 'Batería')).toBe('entra con el hi-hat')
    expect(noteFor(song, 'Voz')).toBe('')
  })
  it('las notas de los demás, sin la propia', () => {
    expect(otherNotes(song, 'Bajo')).toEqual([['Batería', 'entra con el hi-hat']])
    expect(otherNotes(song, null)).toHaveLength(2)
  })
})
