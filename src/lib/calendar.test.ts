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
