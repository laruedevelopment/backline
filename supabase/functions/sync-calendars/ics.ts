// Convierte un calendario iCal en franjas ocupadas. Solo se conservan las horas: nunca títulos ni detalles.
// Está aparte de index.ts para poder probarlo con vitest.
import ICAL from 'ical.js'

export type Busy = { starts_at: string; ends_at: string }
type Range = { start: number; end: number }

const DAY = 86_400_000
const MAX_OCCURRENCES = 1500 // por evento recurrente
const MAX_BLOCKS = 2000

/** "2026-10-27" a las 00:00 de Colombia (UTC-5, sin horario de verano). */
const bogotaMidnight = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 5, 0, 0)

function rangeOf(start: ICAL.Time, end: ICAL.Time): Range | null {
  if (start.isDate) {
    // Evento de todo el día: bloquea los días completos (en hora de Colombia).
    const s = bogotaMidnight(start.year, start.month, start.day)
    const e = end ? bogotaMidnight(end.year, end.month, end.day) : s + DAY
    return { start: s, end: Math.max(e, s + DAY) }
  }
  const s = start.toJSDate().getTime()
  const e = (end ?? start).toJSDate().getTime()
  return { start: s, end: e > s ? e : s + 30 * 60_000 } // los eventos sin duración bloquean 30 minutos
}

/** Ocupado entre `from` y `to` según el calendario. Expande eventos recurrentes y respeta excepciones y cancelaciones. */
export function busyFromIcs(text: string, from: Date, to: Date): Busy[] {
  const comp = new ICAL.Component(ICAL.parse(text))
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz) } catch { /* zona horaria repetida */ }
  }

  const masters = new Map<string, ICAL.Event>()
  const loose: ICAL.Event[] = []
  const exceptions: ICAL.Event[] = []
  for (const v of comp.getAllSubcomponents('vevent')) {
    if (String(v.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') continue
    if (String(v.getFirstPropertyValue('transp') ?? '').toUpperCase() === 'TRANSPARENT') continue // "disponible": no bloquea
    const e = new ICAL.Event(v)
    if (e.isRecurrenceException()) exceptions.push(e)
    else masters.set(e.uid, e)
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid)
    if (master) master.relateException(ex)
    else loose.push(ex) // modificada sin evento base visible: cuenta como evento suelto
  }

  const lo = from.getTime(), hi = to.getTime()
  const ranges: Range[] = []
  const add = (r: Range | null) => { if (r && r.end > lo && r.start < hi) ranges.push(r) }

  for (const e of [...masters.values(), ...loose]) {
    if (!e.startDate) continue
    if (!e.isRecurring()) { add(rangeOf(e.startDate, e.endDate)); continue }
    const it = e.iterator()
    for (let n = 0, next = it.next(); next && n < MAX_OCCURRENCES; next = it.next(), n++) {
      const startMs = next.isDate ? bogotaMidnight(next.year, next.month, next.day) : next.toJSDate().getTime()
      if (startMs >= hi) break
      const occ = e.getOccurrenceDetails(next)
      const status = String(occ.item.component.getFirstPropertyValue('status') ?? '').toUpperCase()
      if (status === 'CANCELLED') continue
      add(rangeOf(occ.startDate, occ.endDate))
    }
  }

  // Une las franjas que se tocan o se solapan.
  ranges.sort((a, b) => a.start - b.start)
  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  return merged.slice(0, MAX_BLOCKS).map((r) => ({ starts_at: new Date(r.start).toISOString(), ends_at: new Date(r.end).toISOString() }))
}
