import { describe, expect, it } from 'vitest'
import { lessons } from './learn'

describe('lecciones', () => {
  it('los ids son únicos y cada meta supera el tempo de partida', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length)
    for (const l of lessons) expect(l.bpm.goal, l.id).toBeGreaterThan(l.bpm.start)
  })
  it('los golpes de cada diagrama de batería caen dentro de sus pasos', () => {
    for (const l of lessons) {
      if (l.diagram?.kind !== 'drums') continue
      for (const r of l.diagram.rows) for (const h of r.hits) { expect(h, `${l.id} ${r.name}`).toBeGreaterThanOrEqual(0); expect(h, `${l.id} ${r.name}`).toBeLessThan(l.diagram.steps) }
    }
  })
  it('la batería tiene ejercicios en los tres niveles', () => {
    const d = lessons.filter((l) => l.instrument === 'bateria')
    expect(d.length).toBeGreaterThanOrEqual(10)
    for (const lv of [1, 2, 3]) expect(d.some((l) => l.level === lv), `nivel ${lv}`).toBe(true)
  })
})
