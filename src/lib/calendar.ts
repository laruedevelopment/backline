/** Enlace que abre Google Calendar con el evento ya escrito: un toque y queda en el calendario. */
export function googleCalendarUrl(e: { title: string; start: Date; end: Date; location?: string; details?: string }): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${f(e.start)}/${f(e.end)}` })
  if (e.location) params.set('location', e.location)
  if (e.details) params.set('details', e.details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Misma regla que la base de datos y la función: solo direcciones iCal de Google Calendar. */
const ICAL_URL = /^https:\/\/calendar\.google\.com\/calendar\/ical\/[^/\s]+\/(private-[A-Za-z0-9]+|public)\/basic\.ics$/

/** Limpia lo pegado (espacios, saltos) y devuelve la dirección si es válida. */
export function cleanIcalUrl(raw: string): string | undefined {
  const url = raw.trim()
  return url.length <= 400 && ICAL_URL.test(url) ? url : undefined
}
