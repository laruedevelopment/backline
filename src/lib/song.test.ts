import { describe, expect, it } from 'vitest'
import { initials } from './identity'
import { isStandard, safeLink, tuningSignature, tuningSummary, type Song } from './song'

const song = (tunings: Song['tunings']) => ({ tunings }) as Song

describe('afinación', () => {
  it('estándar sin capo es estándar', () => {
    expect(isStandard(song([{ instrument: 'Todos', tuning: 'E estándar' }]))).toBe(true)
    expect(tuningSummary(song([{ instrument: 'Todos', tuning: 'E estándar' }]))).toBe('E estándar')
  })
  it('el capo cuenta como cambio', () => {
    const s = song([{ instrument: 'Guitarra', tuning: 'E estándar', capo: 2 }])
    expect(isStandard(s)).toBe(false)
    expect(tuningSummary(s)).toBe('E estándar · capo 2')
  })
  it('el resumen solo menciona lo que se sale de lo normal', () => {
    const s = song([{ instrument: 'Guitarra', tuning: 'Drop D' }, { instrument: 'Bajo', tuning: 'E estándar' }])
    expect(tuningSummary(s)).toBe('Guitarra: Drop D')
  })
  it('la firma distingue canciones que obligan a reafinar', () => {
    const a = song([{ instrument: 'Todos', tuning: 'E estándar' }])
    const b = song([{ instrument: 'Guitarra', tuning: 'Drop D' }])
    expect(tuningSignature(a)).not.toBe(tuningSignature(b))
  })
})

describe('safeLink', () => {
  it('solo https de YouTube o Spotify', () => {
    expect(safeLink('https://youtu.be/abc', 'youtube')).toBeDefined()
    expect(safeLink('http://youtu.be/abc', 'youtube')).toBeUndefined()
    expect(safeLink('https://youtu.be/abc', 'spotify')).toBeUndefined()
    expect(safeLink(undefined, 'youtube')).toBeUndefined()
  })
})

describe('initials', () => {
  it('monograma de banda y de persona', () => {
    expect(initials('Los Dedos de Hielo')).toBe('LD')
    expect(initials('Kabaret')).toBe('K')
    expect(initials('Javier Rueda')).toBe('JR')
    expect(initials('  ')).toBe('?')
  })
})
