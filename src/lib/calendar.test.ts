import { describe, expect, it } from 'vitest'
import { googleCalendarUrl } from './calendar'

describe('googleCalendarUrl', () => {
  it('arma el enlace con fechas en UTC y el texto codificado', () => {
    const url = new URL(googleCalendarUrl({
      title: 'Ensayo · Kabaret (Sala A)', start: new Date('2026-10-27T00:00:00Z'), end: new Date('2026-10-27T02:00:00Z'),
      location: 'Sala Resonancia, Cra 33', details: 'Somos 4 & llevamos platillos',
    }))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261027T000000Z/20261027T020000Z')
    expect(url.searchParams.get('text')).toBe('Ensayo · Kabaret (Sala A)')
    expect(url.searchParams.get('details')).toBe('Somos 4 & llevamos platillos')
  })
  it('omite lugar y detalles si no hay', () => {
    const url = new URL(googleCalendarUrl({ title: 'X', start: new Date('2026-10-27T00:00:00Z'), end: new Date('2026-10-27T01:00:00Z') }))
    expect(url.searchParams.has('location')).toBe(false)
    expect(url.searchParams.has('details')).toBe(false)
  })
})

import { cleanIcalUrl } from './calendar'

describe('cleanIcalUrl', () => {
  const ok = 'https://calendar.google.com/calendar/ical/dueno%40gmail.com/private-abc123XYZ/basic.ics'
  it('acepta la dirección secreta de Google (con espacios alrededor)', () => {
    expect(cleanIcalUrl(`  ${ok}\n`)).toBe(ok)
    expect(cleanIcalUrl('https://calendar.google.com/calendar/ical/x%40group.calendar.google.com/public/basic.ics')).toBeDefined()
  })
  it('rechaza otros dominios, http y rutas que no son iCal', () => {
    expect(cleanIcalUrl('https://evil.example/calendar/ical/x/private-abc/basic.ics')).toBeUndefined()
    expect(cleanIcalUrl('http://calendar.google.com/calendar/ical/x/private-abc/basic.ics')).toBeUndefined()
    expect(cleanIcalUrl('https://calendar.google.com/calendar/u/0/embed?src=x')).toBeUndefined()
    expect(cleanIcalUrl('https://calendar.google.com.evil.com/calendar/ical/x/private-abc/basic.ics')).toBeUndefined()
    expect(cleanIcalUrl('')).toBeUndefined()
  })
})
