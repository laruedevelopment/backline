import { describe, expect, it } from 'vitest'
import { bogotaDate, buildSlots, formatTime, todayBogota, weekdayOf } from './slots'

const FAR_PAST = new Date('2026-01-01T00:00:00Z')

describe('weekdayOf / bogotaDate', () => {
  it('calcula el día de la semana de Colombia', () => {
    expect(weekdayOf('2026-10-25')).toBe(0) // domingo
    expect(weekdayOf('2026-10-26')).toBe(1) // lunes
  })
  it('interpreta las horas como hora de Colombia (UTC-5)', () => {
    expect(bogotaDate('2026-10-26', '19:00:00').toISOString()).toBe('2026-10-27T00:00:00.000Z')
    expect(formatTime(bogotaDate('2026-10-26', '19:00'))).toMatch(/7:00/)
  })
  it('el día de hoy usa la fecha de Colombia, no la UTC', () => {
    // 02:00 UTC del 27 = 21:00 del 26 en Colombia
    expect(todayBogota(new Date('2026-10-27T02:00:00Z'))).toBe('2026-10-26')
  })
})

describe('buildSlots', () => {
  const base = { date: '2026-10-26', opens: '18:00:00', closes: '22:00:00', minutes: 60, now: FAR_PAST }

  it('genera franjas cada 30 min que terminan antes del cierre', () => {
    const slots = buildSlots({ ...base, busy: [] })
    expect(slots).toHaveLength(7) // 18:00 … 21:00
    expect(slots.every((s) => s.free)).toBe(true)
    expect(slots[0].start.toISOString()).toBe('2026-10-26T23:00:00.000Z')
  })

  it('marca como ocupadas las franjas que se solapan con una reserva confirmada', () => {
    // ocupado 19:00-20:00 (Colombia) = 00:00-01:00 UTC
    const slots = buildSlots({ ...base, busy: [{ starts_at: '2026-10-27T00:00:00Z', ends_at: '2026-10-27T01:00:00Z' }] })
    const free = slots.filter((s) => s.free).map((s) => s.start.toISOString())
    expect(slots.filter((s) => !s.free)).toHaveLength(3) // 18:30, 19:00, 19:30
    expect(free).not.toContain('2026-10-27T00:00:00.000Z')
  })

  it('una franja que empieza justo cuando termina otra no se solapa', () => {
    const slots = buildSlots({ ...base, busy: [{ starts_at: '2026-10-26T23:00:00Z', ends_at: '2026-10-27T00:00:00Z' }] })
    expect(slots.find((s) => s.start.toISOString() === '2026-10-27T00:00:00.000Z')?.free).toBe(true)
  })

  it('no ofrece franjas pasadas ni con menos de una hora de anticipación', () => {
    const now = new Date('2026-10-26T23:30:00Z') // 18:30 en Colombia
    const slots = buildSlots({ ...base, now, busy: [] })
    expect(slots.filter((s) => s.free)[0].start.toISOString()).toBe('2026-10-27T00:30:00.000Z') // 19:30
  })

  it('duraciones largas dejan menos franjas', () => {
    expect(buildSlots({ ...base, minutes: 180, busy: [] })).toHaveLength(3) // 18:00, 18:30, 19:00
  })

  it('sin horario suficiente no hay franjas', () => {
    expect(buildSlots({ ...base, closes: '18:30', busy: [] })).toEqual([])
  })
})
