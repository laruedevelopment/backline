import { describe, expect, it } from 'vitest'
import { busyFromIcs } from './ics'

const wrap = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Google Inc//Google Calendar//EN\r\n${events}\r\nEND:VCALENDAR\r\n`
const ev = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`

const FROM = new Date('2026-10-01T00:00:00Z')
const TO = new Date('2026-12-31T00:00:00Z')

describe('busyFromIcs', () => {
  it('un evento normal bloquea sus horas', () => {
    const ics = wrap(ev(['UID:a1', 'DTSTART:20261027T000000Z', 'DTEND:20261027T020000Z', 'SUMMARY:Los Chinos (secreto)']))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([{ starts_at: '2026-10-27T00:00:00.000Z', ends_at: '2026-10-27T02:00:00.000Z' }])
  })

  it('no devuelve títulos ni detalles, solo horas', () => {
    const out = JSON.stringify(busyFromIcs(wrap(ev(['UID:a1', 'DTSTART:20261027T000000Z', 'DTEND:20261027T020000Z', 'SUMMARY:Algo privado', 'DESCRIPTION:Tel 300'])), FROM, TO))
    expect(out).not.toMatch(/privado|Tel/)
  })

  it('expande eventos semanales y respeta fechas excluidas (EXDATE)', () => {
    const ics = wrap(ev(['UID:w1', 'DTSTART:20261005T230000Z', 'DTEND:20261006T010000Z', 'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE:20261012T230000Z']))
    const starts = busyFromIcs(ics, FROM, TO).map((b) => b.starts_at)
    expect(starts).toEqual(['2026-10-05T23:00:00.000Z', '2026-10-19T23:00:00.000Z', '2026-10-26T23:00:00.000Z'])
  })

  it('una excepción mueve solo esa ocurrencia', () => {
    const ics = wrap([
      ev(['UID:w2', 'DTSTART:20261005T230000Z', 'DTEND:20261006T010000Z', 'RRULE:FREQ=WEEKLY;COUNT=2']),
      ev(['UID:w2', 'RECURRENCE-ID:20261012T230000Z', 'DTSTART:20261013T200000Z', 'DTEND:20261013T220000Z']),
    ].join('\r\n'))
    const starts = busyFromIcs(ics, FROM, TO).map((b) => b.starts_at)
    expect(starts).toEqual(['2026-10-05T23:00:00.000Z', '2026-10-13T20:00:00.000Z'])
  })

  it('ignora eventos cancelados y los marcados como "disponible"', () => {
    const ics = wrap([
      ev(['UID:c1', 'DTSTART:20261027T000000Z', 'DTEND:20261027T020000Z', 'STATUS:CANCELLED']),
      ev(['UID:t1', 'DTSTART:20261028T000000Z', 'DTEND:20261028T020000Z', 'TRANSP:TRANSPARENT']),
    ].join('\r\n'))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([])
  })

  it('un evento de todo el día bloquea el día completo en hora de Colombia', () => {
    const ics = wrap(ev(['UID:d1', 'DTSTART;VALUE=DATE:20261030', 'DTEND;VALUE=DATE:20261031', 'SUMMARY:Cerrado']))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([{ starts_at: '2026-10-30T05:00:00.000Z', ends_at: '2026-10-31T05:00:00.000Z' }])
  })

  it('une franjas que se tocan o se solapan', () => {
    const ics = wrap([
      ev(['UID:m1', 'DTSTART:20261027T000000Z', 'DTEND:20261027T020000Z']),
      ev(['UID:m2', 'DTSTART:20261027T020000Z', 'DTEND:20261027T030000Z']),
      ev(['UID:m3', 'DTSTART:20261027T013000Z', 'DTEND:20261027T023000Z']),
    ].join('\r\n'))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([{ starts_at: '2026-10-27T00:00:00.000Z', ends_at: '2026-10-27T03:00:00.000Z' }])
  })

  it('respeta la zona horaria del evento (America/Bogota)', () => {
    const tz = 'BEGIN:VTIMEZONE\r\nTZID:America/Bogota\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0500\r\nTZNAME:-05\r\nEND:STANDARD\r\nEND:VTIMEZONE'
    const ics = wrap(tz + '\r\n' + ev(['UID:z1', 'DTSTART;TZID=America/Bogota:20261027T190000', 'DTEND;TZID=America/Bogota:20261027T210000']))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([{ starts_at: '2026-10-28T00:00:00.000Z', ends_at: '2026-10-28T02:00:00.000Z' }])
  })

  it('descarta lo que queda fuera de la ventana pedida', () => {
    const ics = wrap(ev(['UID:o1', 'DTSTART:20250101T000000Z', 'DTEND:20250101T020000Z']))
    expect(busyFromIcs(ics, FROM, TO)).toEqual([])
  })

  it('un evento recurrente sin fin no se desborda', () => {
    const ics = wrap(ev(['UID:inf', 'DTSTART:20261001T230000Z', 'DTEND:20261002T000000Z', 'RRULE:FREQ=DAILY']))
    const out = busyFromIcs(ics, FROM, new Date('2027-01-31T00:00:00Z'))
    expect(out.length).toBeGreaterThan(80)
    expect(out.length).toBeLessThan(2001)
  })
})
