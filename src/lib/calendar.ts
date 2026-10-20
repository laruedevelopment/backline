/** Enlace que abre Google Calendar con el evento ya escrito: un toque y queda en el calendario. */
export function googleCalendarUrl(e: { title: string; start: Date; end: Date; location?: string; details?: string }): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${f(e.start)}/${f(e.end)}` })
  if (e.location) params.set('location', e.location)
  if (e.details) params.set('details', e.details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
