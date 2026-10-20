/** Horas de reserva. Las salas están en Colombia: UTC-5 todo el año (sin horario de verano). */
const OFFSET = '-05:00'
export const TZ = 'America/Bogota'

const hm = (t: string) => t.slice(0, 5) // Postgres devuelve "18:00:00"

/** Fecha "YYYY-MM-DD" + hora "HH:MM" de Colombia → instante exacto. */
export const bogotaDate = (date: string, time: string) => new Date(`${date}T${hm(time)}:00${OFFSET}`)

/** 0 = domingo … 6 = sábado, del día calendario en Colombia (igual que el horario guardado). */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00${OFFSET}`).getUTCDay()

/** Hoy en Colombia como "YYYY-MM-DD". */
export const todayBogota = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)

export const formatTime = (d: Date) => d.toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export const formatDay = (d: Date) => cap(d.toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }))

export type Slot = { start: Date; end: Date; free: boolean }
export type Busy = { starts_at: string; ends_at: string }

type Input = {
  date: string
  opens: string
  closes: string
  /** Duración de la reserva en minutos. */
  minutes: number
  busy: Busy[]
  now?: Date
  /** Cada cuántos minutos puede empezar una franja. */
  step?: number
  /** Anticipación mínima en minutos (igual que la regla de la base de datos: 1 hora). */
  lead?: number
}

/** Franjas posibles de un día, marcando cuáles están libres. */
export function buildSlots({ date, opens, closes, minutes, busy, now = new Date(), step = 30, lead = 60 }: Input): Slot[] {
  const open = bogotaDate(date, opens).getTime()
  const close = bogotaDate(date, closes).getTime()
  const earliest = now.getTime() + lead * 60_000
  const taken = busy.map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const)
  const out: Slot[] = []
  for (let t = open; t + minutes * 60_000 <= close; t += step * 60_000) {
    const end = t + minutes * 60_000
    const overlaps = taken.some(([a, b]) => a < end && b > t)
    out.push({ start: new Date(t), end: new Date(end), free: !overlaps && t >= earliest })
  }
  return out
}

export const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
/** Orden de la semana para mostrar: empieza el lunes. */
export const weekOrder = [1, 2, 3, 4, 5, 6, 0]

export const money = (n: number) => (n > 0 ? `$${n.toLocaleString('es-CO')}` : 'Consultar')
