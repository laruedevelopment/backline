import { describe, expect, it } from 'vitest'
import { initials } from './identity'
import { isStandard, safeLink, tuningSignature, tuningSummary, usefulNote, type Song, splitShift, setupChanges, fullTuning } from './song'

const song = (tunings: Song['tunings']) => ({ tunings }) as Song

describe('afinación', () => {
  it('estándar sin capo es estándar', () => {
    expect(isStandard(song([{ instrument: 'Todos', tuning: 'E estándar' }]))).toBe(true)
    expect(tuningSummary(song([{ instrument: 'Todos', tuning: 'E estándar' }]))).toBe('E estándar')
  })
  it('el capo cuenta como cambio', () => {
    const s = song([{ instrument: 'Guitarra', tuning: 'E estándar', capo: 2 }])
    expect(isStandard(s)).toBe(false)
    expect(tuningSummary(s)).toBe('E estándar, capo 2')
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

describe('usefulNote', () => {
  const base = { id: 'x', title: 'T', artist: 'A', key: 'Am', bpm: 94, minutes: 4, status: 'learning' as const, tunings: [], keyChanges: [], links: {} }
  it('quita afinación, tono y BPM repetidos y deja la duración', () => {
    expect(usefulNote({ ...base, notes: 'Original: E estándar, Am, 94 BPM, 3:47.' })).toBe('Duración 3:47.')
  })
  it('conserva las dudas y observaciones', () => {
    expect(usefulNote({ ...base, key: 'Bb', bpm: 157, notes: 'Original: E estándar, Bb (mayor o menor según la fuente), 157 BPM, 4:15.' })).toBe('Original: mayor o menor según la fuente, 4:15.')
    expect(usefulNote({ ...base, key: 'Dm', bpm: 134, notes: 'Versión Seether: Drop D según tab (otros dicen Drop C), tono Dm o Gm (las fuentes no coinciden), 134 BPM (67 en half-time), 4:56. Confirmar de oído.' })).toBe('Versión Seether: Drop D según tab (otros dicen Drop C), tono Dm o Gm (las fuentes no coinciden), 67 en half-time, 4:56. Confirmar de oído.')
  })
  it('no toca lo que no coincide con los datos de la tarjeta', () => {
    const n = 'Versión Moderatto: tono, BPM y duración sin confirmar. Referencia del original: ~95 BPM, 4:48, tono discutido.'
    expect(usefulNote({ ...base, key: '', bpm: 100, notes: n })).toBe(n)
  })
  it('deja las líneas sueltas y quita las que quedan vacías', () => {
    expect(usefulNote({ ...base, key: 'E', bpm: 110, notes: 'Original: E, 110 BPM.' })).toBe('')
    expect(usefulNote({ ...base, notes: 'Adaptacion hard rock\nOriginal: Am, 94 BPM.' })).toBe('Adaptacion hard rock')
  })
})

describe('pitch shifter y cambios entre canciones', () => {
  const song = (tunings: Song['tunings']) => ({ tunings } as Song)
  it('separa «con Pitch Shifter -1» del nombre de la afinación', () => {
    expect(splitShift({ instrument: 'Todos', tuning: 'Drop D con Pitch Shifter -1' })).toEqual({ instrument: 'Todos', tuning: 'Drop D', shift: -1 })
    expect(splitShift({ instrument: 'Bajo', tuning: 'E con pitch shifter −3' })).toEqual({ instrument: 'Bajo', tuning: 'E', shift: -3 })
    expect(splitShift({ instrument: 'Todos', tuning: 'Drop D' })).toEqual({ instrument: 'Todos', tuning: 'Drop D' })
  })
  const texts = (a: Song, b: Song) => setupChanges(a, b).map((c) => c.text)
  it('nombra a quién le toca reafinar sin enredar la frase', () => {
    const a = song([{ instrument: 'Todos', tuning: 'Drop D' }])
    const b2 = song([{ instrument: 'Guitarra líder', tuning: 'C#' }, { instrument: 'Bajo', tuning: 'E', shift: -3 }, { instrument: 'Todos', tuning: 'E' }])
    expect(texts(a, b2)).toEqual(['reafinar a E estándar, Guitarra líder a C#', 'pitch shifter en -3 (Bajo)'])
    expect(fullTuning(b2)).toBe('E estándar · Guitarra líder: C# · Bajo: pitch shifter -3')
    expect(tuningSummary(b2)).toBe('Guitarra líder: C# · Bajo: pitch shifter -3')
  })
  it('dice solo lo que cambia', () => {
    const a = song([{ instrument: 'Todos', tuning: 'Drop D', shift: -2 }])
    expect(texts(a, song([{ instrument: 'Todos', tuning: 'Drop D', shift: -1 }]))).toEqual(['pitch shifter en -1'])
    expect(setupChanges(a, song([{ instrument: 'Todos', tuning: 'Drop D' }]))[0].kind).toBe('shift')
    expect(texts(a, song([{ instrument: 'Todos', tuning: 'Drop D' }]))).toEqual(['apagar el pitch shifter'])
    expect(texts(a, song([{ instrument: 'Todos', tuning: 'E estándar', capo: 2 }]))).toEqual(['volver a E estándar', 'capo en traste 2', 'apagar el pitch shifter'])
    expect(texts(a, a)).toEqual([])
  })
})
