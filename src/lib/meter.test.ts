import { describe, expect, it } from 'vitest'
import { clickInterval, countLabel, isMeter, meterSpec } from './meter'

describe('compás', () => {
  it('4/4 y 3/4 cuentan un clic por tiempo', () => {
    expect(meterSpec('4/4').clicks).toBe(4)
    expect(meterSpec('3/4').clicks).toBe(3)
    expect(clickInterval(120, '4/4')).toBeCloseTo(0.5)
    expect(clickInterval(120, '3/4')).toBeCloseTo(0.5)
  })
  it('6/8 cuenta seis clics, con el bpm en la negra con puntillo (cada clic dura un tercio)', () => {
    const m = meterSpec('6/8')
    expect(m.clicks).toBe(6)
    expect(m.strong).toEqual([0, 3])
    expect(clickInterval(60, '6/8')).toBeCloseTo(1 / 3)
  })
  it('un compás desconocido se trata como 4/4', () => {
    expect(meterSpec('13/16').id).toBe('4/4')
    expect(meterSpec(undefined).id).toBe('4/4')
    expect(isMeter('6/8')).toBe(true)
    expect(isMeter('1/1')).toBe(false)
  })
  it('el texto del pre-conteo dice cuántos clics son', () => {
    expect(countLabel(1, '4/4')).toBe('1 compás (4 clics)')
    expect(countLabel(2, '6/8')).toBe('2 compases (12 clics)')
  })
})
