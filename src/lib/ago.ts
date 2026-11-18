/** «hace 5 min», «hace 3 h», «ayer» o la fecha corta (hora de Colombia). */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 172_800) return 'ayer'
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
}
